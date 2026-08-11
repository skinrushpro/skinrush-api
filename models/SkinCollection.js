import { DataTypes } from 'sequelize';

import sequelize from '../db.js';

export const SkinCollection = sequelize.define('SkinCollection', {
  skinId: {
    type: DataTypes.STRING,
    primaryKey: true,
    field: 'skin_id'
  },
  collectionId: {
    type: DataTypes.STRING,
    primaryKey: true,
    field: 'collection_id'
  }
}, {
  tableName: 'skin_collections',
  timestamps: false
});

