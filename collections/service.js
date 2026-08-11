import { Op } from 'sequelize';

const rarityOrder = [
  'Consumer Grade',
  'Industrial Grade',
  'Mil-Spec Grade',
  'Restricted',
  'Classified',
  'Covert',
  'Contraband',
  'Extraordinary'
];

export class CollectionNotFoundError extends Error {
  constructor(slug) {
    super(`Collection not found: ${slug}`);
    this.name = 'CollectionNotFoundError';
    this.code = 'COLLECTION_NOT_FOUND';
  }
}

function plain(record) {
  return typeof record?.get === 'function'
    ? record.get({ plain: true })
    : record;
}

function nullable(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === 'NULL'
    ? null
    : value ?? null;
}

function rarityBreakdown(skins) {
  return skins.reduce((counts, skin) => {
    const rarity = plain(skin).rarity;
    if (rarity) {
      counts[rarity] = (counts[rarity] || 0) + 1;
    }
    return counts;
  }, {});
}

function mapSummary(record) {
  const value = plain(record);
  const skins = value.skins || [];

  return {
    id: value.id,
    slug: value.id,
    name: value.name,
    releaseDate: nullable(value.releaseDate),
    sourceType: nullable(value.sourceType),
    operationName: nullable(value.operationName),
    isActive: value.isActive,
    skinCount: skins.length,
    rarityBreakdown: rarityBreakdown(skins)
  };
}

function rarityRank(rarity) {
  const rank = rarityOrder.indexOf(rarity);
  return rank === -1 ? rarityOrder.length : rank;
}

function mapSkin(record) {
  const value = plain(record);
  return {
    id: value.id,
    name: value.name,
    weapon: value.weapon ?? null,
    rarity: value.rarity ?? null,
    rarityColor: value.rarityColor ?? null,
    category: value.category ?? null,
    minFloat: value.min_float ?? null,
    maxFloat: value.max_float ?? null,
    imageUrl: value.image ?? null,
    stattrak: value.stattrak ?? false,
    souvenir: value.souvenir ?? false
  };
}

function buildWhere({ search, active }) {
  const where = {};

  if (active !== null) {
    where.isActive = active;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { id: { [Op.iLike]: `%${search}%` } }
    ];
  }

  return where;
}

export function createCollectionService({ Collection, Skin }) {
  return {
    async list(query) {
      const result = await Collection.findAndCountAll({
        where: buildWhere(query),
        include: [{
          model: Skin,
          as: 'skins',
          attributes: ['id', 'rarity'],
          through: { attributes: [] },
          required: false
        }],
        distinct: true,
        order: [['name', 'ASC']],
        limit: query.limit,
        offset: query.offset
      });

      return {
        items: result.rows.map(mapSummary),
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total: result.count
        }
      };
    },

    async getBySlug(slug) {
      const record = await Collection.findByPk(slug, {
        include: [{
          model: Skin,
          as: 'skins',
          attributes: [
            'id',
            'name',
            'weapon',
            'rarity',
            'rarityColor',
            'category',
            'min_float',
            'max_float',
            'image',
            'stattrak',
            'souvenir'
          ],
          through: { attributes: [] },
          required: false
        }]
      });

      if (!record) {
        throw new CollectionNotFoundError(slug);
      }

      const value = plain(record);
      const skins = (value.skins || [])
        .map(mapSkin)
        .sort((left, right) => {
          const rarityDifference = rarityRank(left.rarity) - rarityRank(right.rarity);
          return rarityDifference || left.name.localeCompare(right.name);
        });

      return {
        ...mapSummary(value),
        skins
      };
    }
  };
}

