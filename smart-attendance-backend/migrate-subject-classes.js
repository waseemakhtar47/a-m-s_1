const mongoose = require('mongoose');
const Class = require('./models/Class');
const Subject = require('./models/Subject');

async function migrateSubjectClasses() {
  try {
    await mongoose.connect('mongodb://localhost:27017/smart-attendance');
    console.log('Connected to database...');
    
    const classes = await Class.find().populate('subjects.subject');
    console.log(`Found ${classes.length} classes to migrate...`);
    
    let updatedCount = 0;
    
    for (const cls of classes) {
      console.log(`Processing class: ${cls.name} - ${cls.section}`);
      
      for (const subjectObj of cls.subjects) {
        if (subjectObj.subject && subjectObj.subject._id) {
          await Subject.findByIdAndUpdate(
            subjectObj.subject._id,
            { $addToSet: { classes: cls._id } }
          );
          updatedCount++;
          console.log(`✅ Updated subject: ${subjectObj.subject.name} with class: ${cls.name}`);
        }
      }
    }
    
    console.log(`🎉 Migration completed! Updated ${updatedCount} subject-class relationships`);
    
    const subjects = await Subject.find().populate('classes');
    console.log('\n📊 Final Subject-Class Counts:');
    subjects.forEach(subject => {
      console.log(`   ${subject.name}: ${subject.classes.length} classes`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateSubjectClasses();