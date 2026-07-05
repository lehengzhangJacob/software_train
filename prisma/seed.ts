import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.exerciseCalorieReference.count()
  if (existing > 0) {
    console.log('Seed data already exists, skipping.')
    return
  }

  await prisma.exerciseCalorieReference.createMany({
    data: [
      { exerciseName: '步行（慢速，4km/h）', CaloriesPer30min: 80, category: 'aerobic', metValue: 2.8, description: '散步式步行，适合饭后消食' },
      { exerciseName: '步行（中速，5.6km/h）', CaloriesPer30min: 110, category: 'aerobic', metValue: 3.8, description: '正常步行速度' },
      { exerciseName: '步行（快速，7km/h）', CaloriesPer30min: 150, category: 'aerobic', metValue: 5.0, description: '快走，有明显出汗感' },
      { exerciseName: '跑步（慢跑，8km/h）', CaloriesPer30min: 240, category: 'aerobic', metValue: 8.0, description: '慢跑，可边跑边交谈' },
      { exerciseName: '跑步（中速，10km/h）', CaloriesPer30min: 300, category: 'aerobic', metValue: 10.0, description: '中等速度跑步' },
      { exerciseName: '跑步（快速，12km/h）', CaloriesPer30min: 360, category: 'aerobic', metValue: 12.0, description: '快速跑步' },
      { exerciseName: '骑行（休闲，<16km/h）', CaloriesPer30min: 140, category: 'aerobic', metValue: 4.0, description: '休闲骑行' },
      { exerciseName: '骑行（中速，16-22km/h）', CaloriesPer30min: 240, category: 'aerobic', metValue: 8.0, description: '中等速度骑行' },
      { exerciseName: '骑行（快速，>22km/h）', CaloriesPer30min: 330, category: 'aerobic', metValue: 10.0, description: '快速或竞赛骑行' },
      { exerciseName: '游泳（休闲）', CaloriesPer30min: 180, category: 'aerobic', metValue: 6.0, description: '休闲游泳，间歇性' },
      { exerciseName: '游泳（中速，自由泳）', CaloriesPer30min: 250, category: 'aerobic', metValue: 8.3, description: '持续中速游泳' },
      { exerciseName: '跳绳（中速）', CaloriesPer30min: 300, category: 'aerobic', metValue: 10.0, description: '中等速度跳绳' },
      { exerciseName: '跳绳（快速）', CaloriesPer30min: 360, category: 'aerobic', metValue: 12.0, description: '快速跳绳' },
      { exerciseName: '有氧操/健身操', CaloriesPer30min: 200, category: 'aerobic', metValue: 6.5, description: '团体有氧操课程' },
      { exerciseName: '爬楼梯', CaloriesPer30min: 250, category: 'aerobic', metValue: 8.0, description: '匀速爬楼梯' },
      { exerciseName: '椭圆机', CaloriesPer30min: 210, category: 'aerobic', metValue: 7.0, description: '椭圆机中等强度' },
      { exerciseName: '划船机', CaloriesPer30min: 210, category: 'aerobic', metValue: 7.0, description: '划船机中等强度' },
      { exerciseName: '力量训练（中等强度）', CaloriesPer30min: 150, category: 'strength', metValue: 5.0, description: '举重、器械训练等' },
      { exerciseName: '力量训练（高强度）', CaloriesPer30min: 210, category: 'strength', metValue: 7.0, description: '大重量/高强度力量训练' },
      { exerciseName: '瑜伽', CaloriesPer30min: 100, category: 'flexibility', metValue: 3.3, description: '哈他瑜伽/流瑜伽' },
      { exerciseName: '太极', CaloriesPer30min: 90, category: 'flexibility', metValue: 3.0, description: '太极拳练习' },
      { exerciseName: '拉伸', CaloriesPer30min: 60, category: 'flexibility', metValue: 2.0, description: '静态拉伸放松' },
      { exerciseName: '羽毛球', CaloriesPer30min: 180, category: 'aerobic', metValue: 5.5, description: '休闲双打' },
      { exerciseName: '篮球（半场）', CaloriesPer30min: 240, category: 'aerobic', metValue: 8.0, description: '半场对抗' },
      { exerciseName: '家务劳动（清洁/拖地）', CaloriesPer30min: 100, category: 'other', metValue: 3.3, description: '中度家务劳动' },
    ],
  })

  const user1 = await prisma.userProfile.create({
    data: {
      username: '测试用户_张三', gender: 'male', age: 28, heightCm: 175, weightKg: 70,
      dailyCalorieTarget: 2200, dailyProteinTarget: 80, dailyFatTarget: 65, dailyCarbsTarget: 280,
      activityLevel: 'moderately_active',
    },
  })

  const user2 = await prisma.userProfile.create({
    data: {
      username: '测试用户_李四', gender: 'female', age: 25, heightCm: 162, weightKg: 55,
      dailyCalorieTarget: 1800, dailyProteinTarget: 60, dailyFatTarget: 50, dailyCarbsTarget: 220,
      activityLevel: 'lightly_active',
    },
  })

  const today = new Date().toISOString().slice(0, 10)

  await prisma.mealRecord.createMany({
    data: [
      { userId: user1.userId, foodName: '鸡蛋（煮）x2', mealType: 'breakfast', calories: 144, proteinG: 12.6, fatG: 9.6, carbsG: 1.2, portionDesc: '2个中等大小', recordDate: today, recordTime: '08:00', notes: '水煮蛋' },
      { userId: user1.userId, foodName: '全麦面包x2', mealType: 'breakfast', calories: 180, proteinG: 7.0, fatG: 2.5, carbsG: 35.0, portionDesc: '2片', recordDate: today, recordTime: '08:00' },
      { userId: user1.userId, foodName: '牛奶（全脂）', mealType: 'breakfast', calories: 150, proteinG: 8.0, fatG: 8.0, carbsG: 12.0, portionDesc: '1杯约250ml', recordDate: today, recordTime: '08:00' },
      { userId: user1.userId, foodName: '米饭', mealType: 'lunch', calories: 260, proteinG: 5.2, fatG: 0.6, carbsG: 57.0, portionDesc: '1碗约200g', recordDate: today, recordTime: '12:30' },
      { userId: user1.userId, foodName: '宫保鸡丁', mealType: 'lunch', calories: 350, proteinG: 28.0, fatG: 18.0, carbsG: 12.0, portionDesc: '1份约250g', recordDate: today, recordTime: '12:30' },
      { userId: user1.userId, foodName: '番茄蛋汤', mealType: 'dinner', calories: 120, proteinG: 6.0, fatG: 6.0, carbsG: 8.0, portionDesc: '1碗约300ml', recordDate: today, recordTime: '18:30' },
      { userId: user1.userId, foodName: '清蒸鱼', mealType: 'dinner', calories: 200, proteinG: 32.0, fatG: 6.0, carbsG: 2.0, portionDesc: '1条约200g', recordDate: today, recordTime: '18:30' },
      { userId: user2.userId, foodName: '酸奶+蓝莓', mealType: 'breakfast', calories: 180, proteinG: 10.0, fatG: 3.0, carbsG: 28.0, portionDesc: '1杯酸奶+一把蓝莓', recordDate: today, recordTime: '07:45' },
      { userId: user2.userId, foodName: '鸡胸肉沙拉', mealType: 'lunch', calories: 320, proteinG: 35.0, fatG: 12.0, carbsG: 15.0, portionDesc: '1份约350g', recordDate: today, recordTime: '12:00', notes: '低脂高蛋白' },
      { userId: user2.userId, foodName: '三文鱼+芦笋', mealType: 'dinner', calories: 420, proteinG: 38.0, fatG: 22.0, carbsG: 10.0, portionDesc: '三文鱼150g+芦笋200g', recordDate: today, recordTime: '18:00', notes: '健康晚餐' },
      { userId: user2.userId, foodName: '坚果混合', mealType: 'snack', calories: 160, proteinG: 5.0, fatG: 14.0, carbsG: 6.0, portionDesc: '一小把约30g', recordDate: today, recordTime: '15:30', notes: '下午加餐' },
    ],
  })

  console.log('Seed data created successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
