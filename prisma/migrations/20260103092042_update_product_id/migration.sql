-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "productId" INTEGER;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "GroupProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
