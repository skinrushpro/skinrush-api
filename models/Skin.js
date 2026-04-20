import { DataTypes } from 'sequelize';
import sequelize from '../db.js';

export const Skin = sequelize.define('Skin', {

  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    field: 'skin_id'
  },

  name: {
    type: DataTypes.STRING,
    field: 'skin_name'
  },

  weapon: {
    type: DataTypes.STRING,
    field: 'weapon_name'
  },

  rarity: {
    type: DataTypes.STRING,
    field: 'rarity_name'
  },

  category: {
    type: DataTypes.STRING,
    field: 'category_name'
  },

  min_float: {
    type: DataTypes.FLOAT,
    field: 'min_float'
  },

  max_float: {
    type: DataTypes.FLOAT,
    field: 'max_float'
  },

  stattrak: {
    type: DataTypes.BOOLEAN,
    field: 'stattrak'
  },

  souvenir: {
    type: DataTypes.BOOLEAN,
    field: 'souvenir'
  },

  rarityColor: {
    type: DataTypes.STRING,
    field: 'rarity_color'
  },

  paintIndex: {
    type: DataTypes.INTEGER,
    field: 'paint_index'
  },

  image: {
    type: DataTypes.STRING,
    field: 'image_url'
  },

  phase: {
    type: DataTypes.STRING,
    field: 'phase'
  },

  description: {
    type: DataTypes.TEXT,
    field: 'description'
  }

}, {
  tableName: 'skins',
  timestamps: false
});