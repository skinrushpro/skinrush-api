import { Collection } from './Collection.js';
import { Skin } from './Skin.js';
import { SkinCollection } from './SkinCollection.js';

Skin.belongsToMany(Collection, {
  as: 'collections',
  through: SkinCollection,
  foreignKey: 'skinId',
  otherKey: 'collectionId'
});

Collection.belongsToMany(Skin, {
  as: 'skins',
  through: SkinCollection,
  foreignKey: 'collectionId',
  otherKey: 'skinId'
});

export { Collection, Skin, SkinCollection };

