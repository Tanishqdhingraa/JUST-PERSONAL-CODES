const express = require('express');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Test DB Connection on startup
async function testConnection() {
  try {
    const connection = await db.getConnection();
    console.log('✓ Successfully connected to the MySQL database.');
    connection.release();
  } catch (error) {
    console.error('✗ Unable to connect to the MySQL database on startup.');
    console.error(`Error details: ${error.message}`);
    console.error('Please verify your MySQL server is running and database configuration in .env is correct.');
  }
}

testConnection();

// --- CRUD Routes for Users ---

// 1. CREATE: Add a new user
app.post('/api/users', async (req, res) => {
  const { name, email } = req.body;

  // Basic validation
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required fields.' });
  }

  try {
    const [result] = await db.query(
      'INSERT INTO users (name, email) VALUES (?, ?)',
      [name, email]
    );

    // Fetch the newly created user to return it
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: 'User created successfully.',
      user: rows[0]
    });
  } catch (error) {
    console.error('Error inserting user:', error);
    // Handle unique constraint violation (duplicate email)
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Failed to create user due to a server error.' });
  }
});

// 2. READ ALL: Get all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM users ORDER BY id DESC');
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users due to a server error.' });
  }
});

// 3. READ ONE: Get a single user by ID
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: `User with ID ${id} not found.` });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error(`Error fetching user with ID ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch user due to a server error.' });
  }
});

// 4. UPDATE: Update a user's details by ID
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;

  if (!name && !email) {
    return res.status(400).json({ error: 'At least one field (name or email) must be provided for update.' });
  }

  try {
    // Check if the user exists
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: `User with ID ${id} not found.` });
    }

    // Build dynamic query
    const fieldsToUpdate = [];
    const queryParams = [];

    if (name) {
      fieldsToUpdate.push('name = ?');
      queryParams.push(name);
    }
    if (email) {
      fieldsToUpdate.push('email = ?');
      queryParams.push(email);
    }

    queryParams.push(id); // For the WHERE clause

    const queryStr = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    await db.query(queryStr, queryParams);

    // Fetch and return the updated user
    const [updatedRows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);

    res.status(200).json({
      message: 'User updated successfully.',
      user: updatedRows[0]
    });
  } catch (error) {
    console.error(`Error updating user with ID ${id}:`, error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A user with this email already exists.' });
    }
    res.status(500).json({ error: 'Failed to update user due to a server error.' });
  }
});

// 5. DELETE: Delete a user by ID
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if the user exists
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: `User with ID ${id} not found.` });
    }

    await db.query('DELETE FROM users WHERE id = ?', [id]);

    res.status(200).json({ message: `User with ID ${id} successfully deleted.` });
  } catch (error) {
    console.error(`Error deleting user with ID ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete user due to a server error.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
