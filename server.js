import 'dotenv/config';

import { createApp } from './app.js';
import { createCollectionService } from './collections/service.js';
import sequelize from './db.js';
import { Collection, Skin } from './models/associations.js';

const port = process.env.PORT || 3000;
const collectionService = createCollectionService({ Collection, Skin });
const app = createApp({ sequelize, Skin, collectionService });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
