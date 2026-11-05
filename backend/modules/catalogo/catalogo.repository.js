// Repositório do catálogo: categorias e unidades de medida.
const { pool } = require('../../config/db');

class CatalogoRepository {
  async listCategorias() {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.description, c.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
         FROM categories c
        ORDER BY c.name`
    );
    return rows;
  }

  async findCategoriaById(id) {
    const [rows] = await pool.query('SELECT id, name, description FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async findCategoriaByName(name) {
    const [rows] = await pool.query('SELECT id, name FROM categories WHERE name = ?', [name]);
    return rows[0] || null;
  }

  async createCategoria({ name, description }) {
    const [result] = await pool.query('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description]);
    return this.findCategoriaById(result.insertId);
  }

  async updateCategoria(id, { name, description }) {
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (!fields.length) return this.findCategoriaById(id);
    params.push(id);
    await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findCategoriaById(id);
  }

  async deleteCategoria(id) {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [id]);
    return result.affectedRows;
  }

  async listUnidades() {
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.symbol,
              (SELECT COUNT(*) FROM products p WHERE p.unit_id = u.id) AS product_count
         FROM units u
        ORDER BY u.name`
    );
    return rows;
  }

  async findUnidadeById(id) {
    const [rows] = await pool.query('SELECT id, name, symbol FROM units WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async findUnidadeBySymbol(symbol) {
    const [rows] = await pool.query('SELECT id, symbol FROM units WHERE symbol = ?', [symbol]);
    return rows[0] || null;
  }

  async findUnidadeByName(name) {
    const [rows] = await pool.query('SELECT id, name FROM units WHERE name = ?', [name]);
    return rows[0] || null;
  }

  async createUnidade({ name, symbol }) {
    const [result] = await pool.query('INSERT INTO units (name, symbol) VALUES (?, ?)', [name, symbol]);
    return this.findUnidadeById(result.insertId);
  }

  async updateUnidade(id, { name, symbol }) {
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (symbol !== undefined) { fields.push('symbol = ?'); params.push(symbol); }
    if (!fields.length) return this.findUnidadeById(id);
    params.push(id);
    await pool.query(`UPDATE units SET ${fields.join(', ')} WHERE id = ?`, params);
    return this.findUnidadeById(id);
  }

  async deleteUnidade(id) {
    const [result] = await pool.query('DELETE FROM units WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = new CatalogoRepository();
