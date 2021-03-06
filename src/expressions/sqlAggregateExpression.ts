/*
 * Copyright 2016-2020 Imply Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { parseSqlExpression, SqlRef, SqlExpression, SqlFunction, SqlCase } from 'druid-query-toolkit';
import { PlywoodValue } from '../datatypes/index';
import { SQLDialect } from '../dialect/baseDialect';
import { ChainableExpression, Expression, ExpressionJS, ExpressionValue } from './baseExpression';
import { Aggregate } from './mixins/aggregate';

export class SqlAggregateExpression extends ChainableExpression {
  static op = 'SqlAggregate';

  static substituteFilter(sqlExpression: SqlExpression, condition: SqlExpression): SqlExpression {
    return sqlExpression.walk(x => {
      if (x instanceof SqlRef) {
        if (x.column && x.table === 't') {
          return SqlCase.ifThenElse(condition, x);
        }
      }
      if (x instanceof SqlFunction && x.isCountStar()) {
        return x.changeWhereExpression(condition);
      }
      return x;
    }) as SqlExpression;
  }

  static fromJS(parameters: ExpressionJS): SqlAggregateExpression {
    let value = ChainableExpression.jsToValue(parameters);
    value.sql = parameters.sql;
    return new SqlAggregateExpression(value);
  }

  public sql: string;
  public parsedSql: SqlExpression;

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this.sql = parameters.sql;
    this._ensureOp('sqlAggregate');
    this._checkOperandTypes('DATASET');
    this.type = 'NUMBER';

    this.parsedSql = parseSqlExpression(this.sql);
  }

  public valueOf(): ExpressionValue {
    let value = super.valueOf();
    value.sql = this.sql;
    return value;
  }

  public toJS(): ExpressionJS {
    let js = super.toJS();
    js.sql = this.sql;
    return js;
  }

  public equals(other: SqlAggregateExpression | undefined): boolean {
    return super.equals(other) && this.sql === other.sql;
  }

  protected _toStringParameters(indent?: int): string[] {
    return [this.sql];
  }

  protected _calcChainableHelper(operandValue: any): PlywoodValue {
    throw new Error('can not compute on SQL aggregate');
  }

  protected _getSQLChainableHelper(dialect: SQLDialect, operandSQL: string): string {
    if (operandSQL.includes(' WHERE ')) {
      const filterParse = parseSqlExpression(operandSQL.split(' WHERE ')[1]);
      return String(SqlAggregateExpression.substituteFilter(this.parsedSql, filterParse));
    } else {
      return `(${this.sql})`;
    }
  }
}

Expression.applyMixins(SqlAggregateExpression, [Aggregate]);
Expression.register(SqlAggregateExpression);
