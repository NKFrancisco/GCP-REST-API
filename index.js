// Nick Francisco  
// CS 493 - Cloud Application Development
// Final Project - Restful API


const router = module.exports = require('express').Router();

router.use('/cars', require('./cars'));
router.use('/parts', require('./parts'));
router.use('/users', require('./users'));