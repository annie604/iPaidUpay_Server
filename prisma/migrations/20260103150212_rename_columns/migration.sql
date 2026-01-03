/*
  Warnings:

  - You are about to drop the column `orderId` on the `UserOrder` table. All the data in the column will be lost.
  - You are about to drop the column `productId` on the `UserOrder` table. All the data in the column will be lost.
  - Added the required column `groupOrderId` to the `UserOrder` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserOrder" DROP CONSTRAINT "UserOrder_orderId_fkey";

-- DropForeignKey
ALTER TABLE "UserOrder" DROP CONSTRAINT "UserOrder_productId_fkey";

-- AlterTable
ALTER TABLE "UserOrder" DROP COLUMN "orderId",
DROP COLUMN "productId",
ADD COLUMN     "groupOrderId" TEXT NOT NULL,
ADD COLUMN     "menuId" TEXT;

-- AddForeignKey
ALTER TABLE "UserOrder" ADD CONSTRAINT "UserOrder_groupOrderId_fkey" FOREIGN KEY ("groupOrderId") REFERENCES "GroupOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserOrder" ADD CONSTRAINT "UserOrder_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "GroupMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;
