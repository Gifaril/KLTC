const express = require('express')
var validator = require("email-validator");
const db = require('./db')
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

function generateAccessToken(id) {
    return jwt.sign(id, 'SECRET123', { expiresIn: '1800s' });
  }


function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
  
    if (token == null) return res.sendStatus(401)
  
    jwt.verify(token, 'SECRET123', (err, id) => {
      console.log(err)
  
      if (err) return res.sendStatus(403)
  
      req.id = id
  
      next()
    })
  }

const server = async ()=> {
    const app = express()

    const port = 8080

    app.use(express.json())

    app.post('/api/admin/create', async (req, res)=> {
        const body = req.body
        if (!validator.validate(body.email)){
            res.status(500).send('Email is not valid')
            return
        }
        const hashPassword = await argon2.hash(body.password)
        console.log(hashPassword)
        const query = {
            text: `
            INSERT INTO admins(first_name, last_name, password, email) VALUES($1, $2, $3, $4)
            `,
            values: [body.first_name, body.last_name, hashPassword, body.email],
          }
        try {
            await db.query(query)
            res.status(200).json({
                status: 'success',
                data: body
            })    
        } catch (error) {
            console.error(error)
            res.status(500).send('Something went wrong!')
        }
    })

    app.post('/api/admin/login', async (req, res)=> {
        const body = req.body

        const query = {
            text: `
            SELECT * FROM admins
            WHERE email = $1
            `,
            values: [body.email]
          }
        try {
            const response = await db.query(query)
            const data = response.rows[0]
            if (!data){
              return  res.status(500).send('Invalid credentials!')
            }
            if (await argon2.verify(data.password, body.password) === false){
                return  res.status(500).send('Invalid credentials!')
            }
            res.status(200).json({
                status: 'success',
                data,
                token: generateAccessToken({id:data.id})
            })  
        } catch (error) {
            console.error(error)
        }
    })

    app.get('/api/admin', authenticateToken, async (req, res)=> {
        console.log(req)
        const query = {
            text: `
            SELECT * FROM admins
            `,
          }
        try {
            const response = await db.query(query)
            res.status(200).json({
                status: 'success',
                data: response.rows
            })  
        } catch (error) {
            console.error(error)
        }
    })

    
    app.listen(port, ()=> {
        console.log('listening on port:', port)
    })   
}

server()