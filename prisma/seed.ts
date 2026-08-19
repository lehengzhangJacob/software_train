import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const referenceData = [
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
]

async function main() {
  await prisma.$transaction(
    referenceData.map((reference) => {
      const { exerciseName, ...values } = reference
      return prisma.exerciseCalorieReference.upsert({
        where: { exerciseName },
        update: values,
        create: { exerciseName, ...values },
      })
    })
  )

  console.log('Exercise reference data is ready.')
}

main()
  .catch((error) => {
    console.error('Seed failed.', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
