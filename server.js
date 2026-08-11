import 'dotenv/config';

import { createApp } from './app.js';
import { createCollectionService } from './collections/service.js';
import sequelize from './db.js';
import { Collection, Skin } from './models/associations.js';
import { createSkinService } from './skins/service.js';

const port = process.env.PORT || 3000;
const collectionService = createCollectionService({ Collection, Skin });
const skinService = createSkinService({ sequelize, Skin });
const app = createApp({ sequelize, skinService, collectionService });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
