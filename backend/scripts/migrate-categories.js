// scripts/migrate-categories.js
require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

async function run() {
  await mongoose.connect(uri);
  const Product = mongoose.connection.collection('products');

  const filter = {
    category: { $exists: true, $type: 'string', $ne: '' },
    $or: [ { categories: { $exists: false } }, { categories: { $size: 0 } } ]
  };

  const before = await Product.countDocuments(filter);
  console.log('Pendientes antes:', before);

  const res = await Product.updateMany(filter, [
    { $set: { categories: ['$category'] } }
  ]);

  const after = await Product.countDocuments(filter);
  console.log('Actualizados:', res.modifiedCount);
  console.log('Pendientes después:', after);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
