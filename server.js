// Nick Francisco  
// CS 493 - Cloud Application Development
// Final Project - Restful API

const express = require('express');
const app = express();

app.use('/', require('./index'));
app.enable('trust proxy');

const ds = require('./datastore');
const datastore = ds.datastore;
const USER = "User";

const { auth } = require('express-openid-connect');
const { requiresAuth } = require('express-openid-connect');

// Auth0 configuration
const config = {
    authRequired: false,
    auth0Logout: true,
    baseURL: 'https://francnic-final-project.uw.r.appspot.com',
    clientID: 'nTof6IpKYDmTrGWsmVQfz32lHnD9nKaN',
    issuerBaseURL: 'https://cs493-francnic.us.auth0.com',
    secret: '9PtoTz90Tt80XGaFQpFVngZb2ILEsTh8yk5TpgJ-Owo4-Lk5Egnn8TvkSn5bzGX1'
};

// auth router attaches /login, /logout, and /callback routes to the baseURL
app.use(auth(config));


// Display Logged in status and user info
app.get('/', (req, res) => {

    if (req.oidc.isAuthenticated()) {

        // Add user to database
        const user = get_user(req.oidc.user.sub)
        .then(u => {

            // User not in database
            if(u.length == 0) {

                post_user(req.oidc.user.sub)
                .then(key => {

                    // New user info to display
                    const user_info = {};
                    user_info["userToken"] = req.oidc.idToken;
                    user_info["userID"] = req.oidc.user.sub;
                    res.status(200).json(user_info)
                })
            }
            // User already in database
            else {

                // Returning user info to display
                const user_info = {};
                user_info["userToken"] = req.oidc.idToken;
                user_info["userID"] = req.oidc.user.sub;
                res.status(200).json(user_info)
            }

        })

    }
    else {
        res.send('Logged out, Login at https://francnic-final-project.uw.r.appspot.com/login, Logout at https://francnic-final-project.uw.r.appspot.com/logout')
    }
  });

// Welcome page
app.get('/welcome', requiresAuth(), (req, res) => {
res.redirect('/')
});

// Post new user
function post_user(user_id){
    var key = datastore.key(USER);
	const new_user = {"user_id": user_id};
	return datastore.save({"key":key, "data":new_user}).then(() => {return key});
}

// Get user by user_id
function get_user(user_id){
	const q = datastore.createQuery(USER);
	return datastore.runQuery(q).then( (entities) => {
			return entities[0].map(ds.fromDatastore).filter( item => item.user_id === user_id);
		});
}

// Error catch handler 
app.use(function (err, req, res, next) {
    // Catch cjeckJwt error 
    if (err.name === "UnauthorizedError") {
        res.status(401).json({ Error: " Invalid token." })
    }
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});
