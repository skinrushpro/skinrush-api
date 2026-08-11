import { DataTypes } from 'sequelize';

import sequelize from '../db.js';

export const Collection = sequelize.define('Collection', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
    field: 'collection_id'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'collection_name'
  },
  releaseDate: {
    type: DataTypes.DATEONLY,
    field: 'release_date'
  },
  sourceType: {
    type: DataTypes.STRING,
    field: 'source_type'
  },
  operationName: {
    type: DataTypes.STRING,
    field: 'operation_name'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'collections',
  timestamps: false
});

