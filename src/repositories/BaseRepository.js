const { NotFoundError } = require("../utils/errors");

/**
 * Classe base para repositórios
 */
class BaseRepository {
  constructor(model) {
    this.model = model;
  }

  async findById(id, populate = []) {
    let query = this.model.findById(id).notDeleted();

    if (populate.length > 0) {
      populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    const document = await query.exec();
    if (!document) {
      throw new NotFoundError("Registro não encontrado");
    }

    return document;
  }

  async findOne(filter, populate = []) {
    let query = this.model.findOne(filter).notDeleted();

    if (populate.length > 0) {
      populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    return await query.exec();
  }

  async findAll(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = { "metadata.createdAt": -1 },
      populate = [],
    } = options;

    const skip = (page - 1) * limit;

    let query = this.model
      .find(filter)
      .notDeleted()
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (populate.length > 0) {
      populate.forEach((field) => {
        query = query.populate(field);
      });
    }

    const [data, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments({ ...filter, "metadata.deletedAt": null }),
    ]);

    return { data, total, page, limit };
  }

  async create(data) {
    const document = new this.model(data);
    return await document.save();
  }

  async update(id, data) {
    const document = await this.findById(id);

    Object.assign(document, data);
    document.metadata.updatedAt = new Date();

    return await document.save();
  }

  async delete(id, soft = true) {
    const document = await this.findById(id);

    if (soft) {
      // Soft delete
      document.metadata.deletedAt = new Date();
      return await document.save();
    } else {
      // Hard delete
      return await this.model.findByIdAndDelete(id);
    }
  }

  async exists(filter) {
    const count = await this.model.countDocuments({
      ...filter,
      "metadata.deletedAt": null,
    });
    return count > 0;
  }

  async count(filter = {}) {
    return await this.model.countDocuments({
      ...filter,
      "metadata.deletedAt": null,
    });
  }
}

module.exports = BaseRepository;
