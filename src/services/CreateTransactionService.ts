import { getRepository, getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: string;
  category: string;
}
class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const categoryRepository = getRepository(Category);
    let categoryEntity = await categoryRepository.findOne({
      where: { title: category },
    });
    if (!categoryEntity) {
      categoryEntity = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(categoryEntity);
    }

    if (!['income', 'outcome'].includes(type)) {
      throw new AppError('Unknown transaction type', 400);
    }

    const transactionRepository = getCustomRepository(TransactionRepository);

    if (type === 'outcome') {
      const balance = await transactionRepository.getBalance();

      if (balance.total - value < 0) {
        throw new AppError('Insufficient balance', 400);
      }
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id: categoryEntity.id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
