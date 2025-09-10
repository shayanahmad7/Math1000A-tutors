const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkEmbeddings() {
  let client;
  try {
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('math1000a_tutors');
    const embeddings = db.collection('embeddings');
    
    const sources = await embeddings.distinct('source');
    console.log('Sources in database:');
    sources.forEach(s => console.log('  -', s));
    
    console.log('\nDocument counts per source:');
    for (const source of sources) {
      const count = await embeddings.countDocuments({ source });
      console.log(`  - ${source}: ${count} documents`);
    }
    
    // Check if we have embeddings for chapters 2 and 3
    const chapter2Sources = ['2_Exponents_Notes', '2_Exponents_Exercises'];
    const chapter3Sources = ['3_Radicals_Notes', '3_Radicals_Exercises'];
    
    console.log('\nChapter 2 embeddings:');
    for (const source of chapter2Sources) {
      const count = await embeddings.countDocuments({ source });
      console.log(`  - ${source}: ${count} documents`);
    }
    
    console.log('\nChapter 3 embeddings:');
    for (const source of chapter3Sources) {
      const count = await embeddings.countDocuments({ source });
      console.log(`  - ${source}: ${count} documents`);
    }
    
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    if (client) await client.close();
  }
}

checkEmbeddings();
