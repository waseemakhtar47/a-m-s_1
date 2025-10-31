const mongoose = require('mongoose');
const Subject = require('./models/Subject');

async function resetSubjectClasses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smart-attendance');
    console.log('Connected to database...');
    
    // ✅ SABHI SUBJECTS KE CLASSES ARRAY KO EMPTY KARO
    const result = await Subject.updateMany(
      {}, 
      { $set: { classes: [] } }
    );
    
    console.log(`✅ Reset ${result.modifiedCount} subjects - All classes arrays cleared to 0`);
    
    // Verify
    const subjects = await Subject.find();
    console.log('\n📊 Final Subject-Class Counts (Should be 0):');
    subjects.forEach(subject => {
      console.log(`   ${subject.name}: ${subject.classes.length} classes`);
    });
    
    console.log('\n🎉 RESET COMPLETE! All subjects now show 0 classes');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

resetSubjectClasses();