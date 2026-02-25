const BaseRepository = require("./BaseRepository");

class PurchaseRepository extends BaseRepository {
  constructor() {
    super("purchases");
  }

  async createPurchase(data) {
    // ensure items is stored as JSON string
    const row = { ...data };
    if (row.items && typeof row.items !== "string") {
      row.items = JSON.stringify(row.items);
    }
    return await this.create(row);
  }

  async findByUser(userId, options = {}) {
    const opts = { ...(options || {}), sort: { id: -1 } };
    const res = await this.findAll({ user: userId }, opts);
    // parse items
    res.data = res.data.map((r) => {
      const copy = { ...r };
      try {
        if (copy.items && typeof copy.items === "string") copy.items = JSON.parse(copy.items);
      } catch (err) {}
      return copy;
    });
    return res;
  }
}

module.exports = new PurchaseRepository();
