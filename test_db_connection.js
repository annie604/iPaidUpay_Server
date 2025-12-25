require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  console.log('🔍 測試資料庫連接...');
  
  try {
    // 測試資料庫連接
    await prisma.$connect();
    console.log('✅ 資料庫連接成功！');
    
    // 測試查詢 - 檢查 User 表格是否存在並可以查詢
    console.log('🔍 測試查詢 User 表格...');
    const userCount = await prisma.user.count();
    console.log(`✅ User 表格查詢成功！目前有 ${userCount} 個使用者`);
    
    // 測試建立一個測試使用者（如果不存在）
    console.log('🔍 測試建立使用者...');
    const testUser = await prisma.user.upsert({
      where: { username: 'test_user' },
      update: {},
      create: {
        username: 'test_user',
        password: 'test_password_hash',
        name: '測試使用者'
      }
    });
    console.log('✅ 使用者建立/更新成功！', { id: testUser.id, username: testUser.username, name: testUser.name });
    
    // 測試查詢剛建立的使用者
    console.log('🔍 測試查詢使用者...');
    const foundUser = await prisma.user.findUnique({
      where: { username: 'test_user' }
    });
    console.log('✅ 使用者查詢成功！', { id: foundUser.id, username: foundUser.username, name: foundUser.name });
    
    console.log('🎉 所有資料庫測試都通過了！');
    
  } catch (error) {
    console.error('❌ 資料庫測試失敗：', error.message);
    console.error('詳細錯誤：', error);
    
    if (error.code === 'P1001') {
      console.log('💡 提示：請確保 PostgreSQL 資料庫正在運行');
      console.log('💡 可以執行：docker-compose up -d');
    }
    
    if (error.code === 'P2021') {
      console.log('💡 提示：表格不存在，請執行資料庫遷移');
      console.log('💡 可以執行：npx prisma migrate dev');
    }
    
  } finally {
    await prisma.$disconnect();
    console.log('🔌 資料庫連接已關閉');
  }
}

// 執行測試
testDatabaseConnection();
