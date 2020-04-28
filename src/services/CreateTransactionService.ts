import { getRepository, getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const currentBalance = await transactionRepository.getBalance();

    if (type === 'outcome' && currentBalance.total < value) {
      throw new AppError(
        'You cannot create a transaction without a positive balance',
      );
    }

    const hasCategory = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!hasCategory) {
      const newCategory = categoryRepository.create({ title: category });

      await categoryRepository.save(newCategory);

      const transaction = transactionRepository.create({
        title,
        value,
        type,
        category_id: newCategory.id,
      });

      await transactionRepository.save(transaction);

      return transaction;
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category_id: hasCategory.id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
