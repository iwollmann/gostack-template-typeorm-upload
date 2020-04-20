import fs from 'fs';
import csv from 'csv-parse';
import path from 'path';
import { getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import uploadConfig from '../config/upload';
import AppError from '../errors/AppError';

interface ImportTransaction {
  title: string;
  value: number;
  type: string;
  category: string;
}
class ImportTransactionsService {
  async execute(fileName: string): Promise<Transaction[]> {
    const file = path.resolve(uploadConfig.destination, fileName);
    const importedTransactions = Array<ImportTransaction>();

    await new Promise((resolve, reject) => {
      fs.createReadStream(file)
        .pipe(
          csv({
            columns: ['title', 'type', 'value', 'category'],
            from_line: 2,
            trim: true,
          }),
        )
        .on('data', data => importedTransactions.push(data))
        .on('end', () => {
          fs.unlinkSync(file);
          resolve();
        })
        .on('error', err => {
          reject(err);
        });
    }).catch(err => {
      throw new AppError(err, 400);
    });

    // Save all not existent categories
    const importedCategories = Array.from(
      new Set(importedTransactions.map(t => t.category)),
    );
    const categoryRepository = getRepository(Category);

    const existedCategories = await categoryRepository.find({
      where: { title: In(importedCategories) },
    });

    const notExistedCategories = importedCategories.filter(
      x => !existedCategories.map(c => c.title).includes(x),
    );

    const categories = notExistedCategories.map(category =>
      categoryRepository.create({ title: category }),
    );

    await categoryRepository.save(categories);

    // Save all transactions
    const transactionRepository = getRepository(Transaction);
    const transactions = importedTransactions.map(
      ({ title, value, type, category }) =>
        transactionRepository.create({
          title,
          value,
          type,
          category_id: categories.find(c => c.title === category)?.id,
        }),
    );

    await transactionRepository.save(transactions);

    return transactions;
  }
}

export default ImportTransactionsService;
