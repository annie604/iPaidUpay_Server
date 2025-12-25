-- CreateTable
CREATE TABLE "GroupProduct" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "groupId" INTEGER NOT NULL,

    CONSTRAINT "GroupProduct_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GroupProduct" ADD CONSTRAINT "GroupProduct_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
