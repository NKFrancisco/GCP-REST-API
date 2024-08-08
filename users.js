// Nick Francisco  
// CS 493 - Cloud Application Development
// Final Project - Restful API


const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const ds = require('./datastore');

const datastore = ds.datastore;

const USER = "User";

router.use(bodyParser.json());

/* ------------- Begin User Model Functions ------------- */

// Get all users
function get_users(){
	const q = datastore.createQuery(USER);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore)
		});
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Get all users
router.get('/', function(req, res){
    const users = get_users(req)
        .then( (users) => {

            // Check if users in database
            if(users.length > 0) {

                // Add self URL to users
                for (let i = 0; i < users.length; i++) {
                    users[i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + users[i].id;
                }
            }

        res.status(200).json(users);
    });
});


/* ------------- End Controller Functions ------------- */

function check_user(user) {
    if (user[0] === undefined || user[0] === null) 
        return false
    else
        return true
}

module.exports = router;