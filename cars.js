// Nick Francisco  
// CS 493 - Cloud Application Development
// Final Project - Restful API


const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const { PropertyFilter } = require('@google-cloud/datastore');

const datastore = ds.datastore;

const CAR = "Car";
const PART = "Part";

router.use(bodyParser.json());

//JWT 
const jwt = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const { entity } = require('@google-cloud/datastore/build/src/entity');

const DOMAIN = 'cs493-francnic.us.auth0.com';

// Jwt check middleware
const checkJwt = jwt({
    secret: jwksRsa.expressJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `https://${DOMAIN}/.well-known/jwks.json`
    }),
  
    // Validate the audience and the issuer.
    issuer: `https://${DOMAIN}/`,
    algorithms: ['RS256']
});

/* ------------- Begin Car Model Functions ------------- */

// Post new car
function post_car(make, model, year, owner){
    var key = datastore.key(CAR);
	const new_car = {"make": make, "model": model, "year": year, "parts": [], "owner": owner };
	return datastore.save({"key":key, "data":new_car}).then(() => {return key});
}

// GET all cars w/pagination
function get_cars(req){
    var q = datastore.createQuery(CAR)
                        .filter('owner', '=', req.user.sub)
                        .limit(5);                  
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
	return datastore.runQuery(q).then((cars) => {
            results.cars = cars[0].map(ds.fromDatastore).filter(item => item.owner === req.user.sub);

            // Add self URL to each car
            let i = 0;
            results.cars.forEach(car => { 
                results.cars[i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + car.id;
                i = i + 1;
            });

            // Add next page URL 
            if(cars[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
                results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + cars[1].endCursor;
                
            }

            // Add total items count 
            let count = 0;
            for (let i = 0; i < cars[0].length; i++) {
                if (cars[0][i].owner === req.user.sub) {
                    count += 1;
                }
            }

            results.count = count
            return results;
		});
}

// Get specific car with :cid
function get_car(cid) { 
    const key = datastore.key([CAR, parseInt(cid, 10)]);
    return datastore.get(key).then((entity) => {

        // Valid id
        if (check_car(entity)) {
            return entity.map(ds.fromDatastore);

        // Invalid id
        } else {
            return entity;
        }
    });
}

// Delete car
function delete_car(cid, owner) {

    // Car from datastore
    const car_key = datastore.key([CAR, parseInt(cid,10)]);
    return datastore.get(car_key)
    .then( (car) => { 
        verification = [false, false];

        // Valid car id
        if (check_car(car)) { 
            verification[0] = true;

            // Check if owner owns car
            if (car[0].owner && car[0].owner === owner) {
                verification[1] = true;
            } 
            // Does not own car
            else {
                return verification;
            }

            // Check if car has parts
            if(car[0].parts.length > 0) {

                // Update all parts with cid 
                for (let i = 0; i < car[0].parts.length; i++) {

                    const pid = car[0].parts[i];
    
                    // Part from datastore
                    const key = datastore.key([PART, parseInt(pid, 10)]);
                    datastore.get(key)
                    .then( (part) => { 

                         // Valid part id
                        if (check_part(part)) {

                            // Update part car info
                            part[0].car = null;
        
                            // Save part info to datastore 
                            datastore.save({"key":key, "data":part[0]});
                        }
                    });
                }
            }
            
        }
    })
    .then( () => {

        if (verification[0] == true && verification[1] == true ) {
            datastore.delete(car_key);
        }

        return verification;
    });
}

// Put part on car 
function put_part(cid, pid, owner){

    // Car from datastore
    const car_key = datastore.key([CAR, parseInt(cid,10)]);
    return datastore.get(car_key)
    .then( (car) => {
        verification = [false, false, false, false];

        // Check if owner owns car
        if (car[0].owner === owner) {
            verification[3] = true;
        }
        // Not owner of car
        else {
            return verification;
        }
       
        // Valid car id
        if (check_car(car)) {
            verification[0] = true;

            // Add part id to car
            car[0].parts.push(pid);

            // Part from datastore
            const part_key = datastore.key([PART, parseInt(pid, 10)]);
            return datastore.get(part_key)
            .then( (part) => {

                // Valid part id
                if (check_part(part)) {
                    verification[1] = true; 

                    // Check part not assigned to car
                    if(part[0].car == null) {
                        verification[2] = true;

                        // Add car id
                        part[0].car = cid;

                        // Save to car info datastore 
                        datastore.save({"key":car_key, "data":car[0]});
                        // Save part info to datastore 
                        datastore.save({"key":part_key, "data":part[0]});
                    }
                }

                return verification;
            });
        } 

        // Invalid car id
        else {
            return verification;
        }
    });
}

// Delete part on car 
function delete_part(cid, pid, owner){ 

    // Car from datastore
    const car_key = datastore.key([CAR, parseInt(cid,10)]);
    return datastore.get(car_key)
    .then( (car) => { 
        verification = [false, false, false, false];

        // Check if owner owns car
        if (car[0].owner === owner) {
            verification[3] = true;
        }
        // Not owner of car
        else {
            return verification;
        }

        // Valid car id
        if (check_car(car)) {
            verification[0] = true;

            // Delete part from car 
            const index = car[0].parts.indexOf(pid);
            if (index > -1) {
                car[0].parts.splice(index, 1);
            }

            // Part from datastore
            const part_key = datastore.key([PART, parseInt(pid, 10)]);
            return datastore.get(part_key)
            .then( (part) => {

                // Valid part id
                if (check_part(part)) {
                    verification[1] = true; 

                    // Check if part assigned to car
                    if(part[0].car != null) {
                        if (part[0].car == cid) {

                            verification[2] = true;
                            // Remove car id
                            part[0].car = null;
    
                            // Save car info to datastore 
                            datastore.save({"key":car_key, "data":car[0]});
                            // Save part info to datastore 
                            datastore.save({"key":part_key, "data":part[0]});
                        }
                    }
                }

                return verification;
            });
        }
        // Invalid car id 
        else {
            return verification;
        }
    });
}

// Patch car 
function patch_car(cid, make, model, year, parts, owner) {
    const key = datastore.key([CAR, parseInt(cid, 10)]);
    const car = { "make": make, "model": model, "year": year, "parts": parts, "owner": owner };
    return datastore.save({ "key": key, "data": car }).then(() => { return key });
}

// Put car all attributes req
function put_car(cid, make, model, year, parts, owner) {
    const key = datastore.key([CAR, parseInt(cid, 10)]);
    const car = { "make": make, "model": model, "year": year, "parts": parts, "owner": owner };
    return datastore.save({ "key": key, "data": car }).then(() => { return key });
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Post new car
router.post('/', checkJwt, function(req, res){
    // Valid attributes 
    if (check_req(req)) { 
        post_car(req.body.make, req.body.model, req.body.year, req.user.sub)
        .then( key => {

            // Get new car to send response
            get_car(key.id)
            .then( car => {

                // Add car URL
                car[0]["self"] = get_car_url(req, car)
                res.status(201).json(car[0]) 
            });
        });
    }
    // Invalid atteributes
    else {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
});


// Get all cars
router.get('/', checkJwt, function(req, res){

    const cars = get_cars(req)
	.then( (cars) => {

        // Accepts 
        const accepts = req.accepts(['application/json']);
        if(!accepts){
            res.status(406).json({Error: 'Not Acceptable'});
            return;
        } 
         // Return JSON 
        else if(accepts === 'application/json'){
            res.status(200).json(cars);
        }
        // Accepts error  
        else { 
            res.status(500).json({ Error: 'Content type got messed up!' }); 
        }
    });
});

// Get specific car
router.get('/:cid', checkJwt, function(req, res){

    const car = get_car(req.params.cid)
	.then( (car) => {

        // Valid id 
        if (check_car(car)) {

            // Check owner
            if (car[0].owner == req.user.sub) {
                // Add self URL 
                car[0]["self"] = get_car_url(req, car);

                    // Accepts check
                    const accepts = req.accepts(['application/json']);
                    if(!accepts){
                        res.status(406).json({Error: 'Not Acceptable'});
                        return;
                    } 
                    // Return JSON 
                    else if(accepts === 'application/json'){
                        res.status(200).json(car[0]);
                    }
                    // Accepts error  
                    else { 
                        res.status(500).json({ Error: 'Content type got messed up!' }); 
                    }
            }
            // Not owner of car
            else {
                res.status(403).json({Error: 'Forbidden'});
            }
        }
        // Invalid id
        else {
            res.status(404).json({ 'Error': 'No car with this car_id exists' });
        }
    });
});

// Delete car 
router.delete('/:cid', checkJwt, function(req, res){ 
    delete_car(req.params.cid, req.user.sub)
    .then ( validation => {

        // Valid car 
        if (validation[0] == true && validation[1] == true) {
            res.status(204).end();
        }
        // Invalid car
        else if (validation[0] == false) {
            res.status(404).json({ Error : "No car with this car_id exists"});
        }
        else if (validation[1] == false) {
            res.status(403).json({Error: 'Forbidden'});
        }
    });
});

// Put part on car 
router.put('/:cid/parts/:pid', checkJwt, function(req, res){
    put_part(req.params.cid, req.params.pid, req.user.sub)
    .then( validation => {

        // Not owner of car 
        if(validation[3] == false) {
            res.status(403).json({Error: 'Forbidden'});
        }
        // Invalid Car or Part id
        else if (validation[0] == false || validation[1] == false) {
            res.status(404).json({ Error: "The specified car and/or part does not exist"});
        } 
        // Part already assigned to car 
        else if (validation[0] == true && validation[1] == true && validation[2] == false) {
            res.status(403).json({ Error: "The part is already installed on another car"});
        }
        // Valid id's and part not assigned yet
        else {  
            res.status(204).end()
        }
    });
});

// Delete part from car
router.delete('/:cid/parts/:pid', checkJwt, function(req, res){ 
    delete_part(req.params.cid, req.params.pid, req.user.sub)
    .then ( validation => {

        // Not owner of car 
        if(validation[3] == false) {
            res.status(403).json({Error: 'Forbidden'});
        }
        // Invalid Car or Part id
        else if (validation[0] == false || validation[1] == false) {
            res.status(404).json({ Error: "No car with this car_id or no part with this part_id exists"});
        } 
        // Part not on Car 
        else if (validation[0] == true && validation[1] == true && validation[2] == false) {
            res.status(404).json({ Error: "No car with this car_id has the part with this part_id installed"});
        }
        // Valid id's and part was on car
        else {  
            res.status(204).end()
        }
    });
});

// Patch car
router.patch('/:cid', checkJwt, function(req, res){ 

    // Accepts check
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Not Acceptable'});
        return;
    } 

    // Check if car id exists 
    get_car(req.params.cid)
        .then(car => {
 
            // Valid car id
            if (check_car(car)) {

                // Check if owner owns car
                if (car[0].owner !== req.user.sub) {
                    // Does not own 
                    res.status(403).json({Error: 'Forbidden'});
                    return;
                }

                // Check for missign attributes in req
                let attributes = set_patch_attributes(req, car[0]);    
               
                    // Update car
                    patch_car(req.params.cid, attributes.make, attributes.model, attributes.year, attributes.parts, attributes.owner)
                    .then( key => {

                        //Get car to send
                        get_car(key.id)
                        .then ( updated_car => {

                            // Set self URL
                            updated_car[0]["self"] = get_car_url(req, updated_car);

                             // Return JSON 
                            if(accepts === 'application/json'){
                                res.status(200).json(updated_car[0]);
                            }
                            // Accepts error  
                            else { 
                                res.status(500).json({ Error: 'Content type got messed up!' }); 
                            }
                        });
                    });  
                        
                    
            }
            // Invalid id
            else {
                res.status(404).json({ 'Error': 'No car with this car_id exists' });
            }
    });
});

// PUT car
router.put('/:cid', checkJwt, function(req, res){
    
    // Accepts check
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Not Acceptable'});
        return;
    } 

    if (check_req(req)) { 

        // Check if car id exists 
        get_car(req.params.cid)
            .then(car => {

                // Valid car id
                if (check_car(car)) {

                    // Check if owner owns car
                    if (car[0].owner !== req.user.sub) {
                        // Does not own 
                        res.status(403).json({Error: 'Forbidden'});
                        return;
                    }
            
                    // Update car
                    put_car(req.params.cid, req.body.make, req.body.model, req.body.year, car[0].parts, car[0].owner)
                    .then( key => {

                        // Set location header 
                        //res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);

                        //Get car to send
                        get_car(key.id)
                        .then ( updated_car => {

                            // Set self URL
                            updated_car[0]["self"] = get_car_url(req, updated_car);

                            // Return JSON 
                            if(accepts === 'application/json'){
                                res.status(200).json(updated_car[0]);
                            }
                            // Accepts error  
                            else { 
                                res.status(500).json({ Error: 'Content type got messed up!' }); 
                            }
                        });
                    });                             
                }
                // Invalid id
                else {
                    res.status(404).json({ 'Error': 'No car with this car_id exists' });
                }
        });
    }
    // Invalid atteributes
    else {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
});

// Cannot DELETE to /
router.delete('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Cannot PUT to /
router.put('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

// Cannot PATCH to /
router.patch('/', function (req, res){
    res.set('Accept', 'GET, POST');
    res.status(405).end();
});

/* ------------- End Controller Functions ------------- */

/* ------------- Helper Functions --------------------- */

function check_req(req) {
    if (req.body.make == null || req.body.model == null || req.body.year == null) {
        return false;
    }
    return true; 
}

function check_car(car) {
    if (car[0] === undefined || car[0] === null) 
        return false
    else
        return true
}

function check_part(part) {
    if (part[0] === undefined || part[0] === null) 
        return false
    else
        return true
}

function get_car_url(req, car) {
    return req.protocol + "://" + req.get("host") + req.baseUrl + "/" + car[0].id;
}

function get_part_url(req, part) {
    return req.protocol + "://" + req.get("host") + "/parts/" + part.id;
}

function set_patch_attributes(req, car) {
    let attributes = {};
    // Make
    if (req.body.make == null) {
        attributes["make"] = car.make
    }
    else {
        attributes["make"] = req.body.make
    }
    // Model
    if (req.body.model == null) {
        attributes["model"] = car.model
    }
    else {
        attributes["model"] = req.body.model
    }
    // Year
    if (req.body.year == null) {
        attributes["year"] = car.year
    }
    else {
        attributes["year"] = req.body.year
    }
    // Parts 
    attributes["parts"] = car.parts;
    // Owner
    attributes["owner"] = car.owner;

    return attributes;
}

/* ------------- End Helper Functions ----------------- */

module.exports = router;