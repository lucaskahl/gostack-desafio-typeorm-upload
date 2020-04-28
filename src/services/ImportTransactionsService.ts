import csv from 'csv-parse';
import path from 'path';
import fs from 'fs';
import { getCustomRepository, getConnection, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

import uploadConfig from '../config/upload';

interface Request {
  fileName: string;
}

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ fileName }: Request): Promise<Transaction[]> {
    const parsers = csv({ delimiter: ', ', from_line: 2 });
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const csvPath = path.join(uploadConfig.directory, fileName);
    const csvReadableStream = fs.createReadStream(csvPath);

    const parseCSV = csvReadableStream.pipe(parsers);

    const transactionsCsv: TransactionCSV[] = [];

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line;

      transactionsCsv.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const categories = transactionsCsv
      .map(transection => transection.category)
      .filter((elem, pos, self) => {
        return self.indexOf(elem) === pos;
      })
      .map(category => categoryRepository.create({ title: category }));

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Category)
      .values(categories)
      .execute();

    const transactions = transactionsCsv.map(transaction => {
      const category_id = categories.find(
        category => category.title === transaction.category,
      )?.id;

      return transactionsRepository.create({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category_id,
      });
    });

    await getConnection()
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values(transactions)
      .execute();

    await fs.promises.unlink(csvPath);

    return transactions;
  }
}

export default ImportTransactionsService;
