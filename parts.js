// Nick Francisco  
// CS 493 - Cloud Application Development
// Final Project - Restful API


const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();

const ds = require('./datastore');

const datastore = ds.datastore;

const CAR = "Car";
const PART = "Part";

router.use(bodyParser.json());

/* ------------- Begin guest Model Functions ------------- */

// Post new part
function post_part(name, component, install_date){
    var key = datastore.key(PART);
	const new_part = {"name": name, "component": component, "install_date": install_date, "car": null};
	return datastore.save({"key":key, "data":new_part}).then(() => {return key});
}

// Get all parts w/ pagination 
function get_parts(req){
    var q = datastore.createQuery(PART).limit(3); 
    const results = {};
    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then( (entities) => {
        results.parts = entities[0].map(ds.fromDatastore);

        // Add self URL to each part
        let i = 0;
        results.parts.forEach(part => {
            results.parts[i]["self"] = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + part.id;
            i = i + 1;
        });

        // Add next page URL 
        if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS ){
            results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + entities[1].endCursor;
        }
        return results;
    });
}

// Get specific part with :id
function get_part(pid) { 
    const key = datastore.key([PART, parseInt(pid, 10)]);
    return datastore.get(key).then((entity) => {

        // Valid id
        if (check_part(entity)) {
            return entity.map(ds.fromDatastore);

        // Invalid id
        } else {
            return entity;
        }
    });
}

// Patch part 
function patch_part(pid, name, component, install_date, car) {
    const key = datastore.key([PART, parseInt(pid, 10)]);
    const part = { "name": name, "component": component, "install_date": install_date, "car": car };
    return datastore.save({ "key": key, "data": part }).then(() => { return key });
}

// Put part all attributes req
function put_part(pid, name, component, install_date, car) {
    const key = datastore.key([PART, parseInt(pid, 10)]);
    const part = { "name": name, "component": component, "install_date": install_date, "car": car };
    return datastore.save({ "key": key, "data": part }).then(() => { return key });
}

// Delete part 
function delete_part(pid){
    // Part from datastore
    const part_key = datastore.key([PART, parseInt(pid, 10)]);
    return datastore.get(part_key)
    .then( (part) => { 
        verification = false;

         // Valid part id
         if (check_part(part)) {
            verification = true;

            // Check if part is on car 
            if (part[0].car != null) {

                // Car from datastore
                const cid = part[0].car;
                const car_key = datastore.key([CAR, parseInt(cid,10)]);
                return datastore.get(car_key)
                .then( (car) => { 

                    // Valid car id
                    if (check_car(car)) {  

                        // Delete part from car 
                        const index = car[0].parts.indexOf(pid);
                        if (index > -1) {
                            car[0].parts.splice(index, 1);

                            // Save to car info datastore 
                            datastore.save({"key":car_key, "data":car[0]});
                        }
                    }
                });
            }
         }        
    })
    .then( () => {
        if (verification) {
            datastore.delete(part_key);
        }
        return verification
    });
}


/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Post new part 
router.post('/', function(req, res){

    // Valid attributes 
    if (check_req(req)) {
        post_part(req.body.name, req.body.component, req.body.install_date)
        .then( key => {
            get_part(key.id)
            .then ( part => {

                // Add part URL
                part[0]["self"] = get_part_url(req, part);
                res.status(201).json(part[0]) 
            });
        });
    } 

    // Invalid attributes 
    else {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
});

// Get all parts w/ pagination 
router.get('/', function(req, res){

    // Accepts 
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Forbidden'});
        return;
    } 

    const parts = get_parts(req)
	.then( (parts) => {

        // Return JSON 
        if(accepts === 'application/json'){
            res.status(200).json(parts);
        }
        // Accepts error  
        else { 
            res.status(500).json({ Error: 'Content type got messed up!'}); 
        }
        
    });
});

// Get specific part
router.get('/:pid', function(req, res){

    // Accepts check
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Forbidden'});
        return;
    } 

    const part = get_part(req.params.pid)
	.then( (part) => {   

        // Valid id 
        if (check_part(part)) {

            // Add self URL 
            part[0]["self"] = get_part_url(req, part);

            // Add car URL           
            if (part[0].car != null) {
                const car_id = part[0].car;
                part[0].car_url = {"self": get_car_url(req, car_id)};
            }

            // Return JSON 
            if(accepts === 'application/json'){
                res.status(200).json(part[0]);
            }
            // Accepts error  
            else { 
                res.status(500).json({ Error: 'Content type got messed up!' }); 
            }

            
        } 

        // Invalid id
        else {
            res.status(404).json({ Error: 'No part with this part_id exists' });
        }
    });
});

// Patch part
router.patch('/:pid', function(req, res){ 

    // Accepts check
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Forbidden'});
        return;
    } 

    // Check if part id exists 
    get_part(req.params.pid)
        .then(part => {    

            // Valid part id
            if (check_part(part)) {

                // Check for missign attributes in req
                let attributes = set_patch_attributes(req, part[0]);    
               
                    // Update part
                    patch_part(req.params.pid, attributes.name, attributes.component, attributes.install_date, attributes.car)
                    .then( key => {

                        //Get part to send
                        get_part(key.id)
                        .then ( updated_part => {

                            // Set self URL
                            updated_part[0]["self"] = get_part_url(req, updated_part);

                            // Return JSON 
                            if(accepts === 'application/json'){
                                res.status(200).json(updated_part[0]);
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
                res.status(404).json({ 'Error': 'No part with this part_id exists' });
            }
    });
});

// PUT part
router.put('/:pid', function(req, res){

    // Accepts check
    const accepts = req.accepts(['application/json']);
    if(!accepts){
        res.status(406).json({Error: 'Forbidden'});
        return;
    } 

    // Check if part id exists 
    get_part(req.params.pid)
        .then(part => {        

            // Valid part id
            if (check_part(part)) {
        
                // Update part
                put_part(req.params.pid, req.body.name, req.body.component, req.body.install_date, part[0].car)
                .then( key => {

                    // Set location header 
                    //res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);

                    //Get part to send
                    get_part(key.id)
                    .then ( updated_part => {

                        // Set self URL
                        updated_part[0]["self"] = get_part_url(req, updated_part);

                        // Return JSON 
                        if(accepts === 'application/json'){
                            res.status(200).json(updated_part[0]);
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

// Delete part 
router.delete('/:pid', function(req, res){ 
    delete_part(req.params.pid)
    .then ( validation => {

        // Valid part 
        if (validation == true) {
            res.status(204).end();
        }

        // Invalid part
        else {
            res.status(404).json({ Error: "No part with this part_id exists"});
        }
    });
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
    if (req.body.name == null || req.body.component == null || req.body.install_date == null) {
        return false;
    }
    return true; 
}

function check_part(part) {
    if (part[0] === undefined || part[0] === null) 
        return false
    else
        return true
}

function check_car(car) {
    if (car[0] === undefined || car[0] === null) 
        return false
    else
        return true
}

function get_part_url(req, part) {
    return req.protocol + "://" + req.get("host") + req.baseUrl + "/" + part[0].id;
}

function get_car_url(req, bid) {
    return req.protocol + "://" + req.get("host") + "/cars/" + bid;
}

function set_patch_attributes(req, part) {
    let attributes = {};
    // Name
    if (req.body.name == null) {
        attributes["name"] = part.name
    }
    else {
        attributes["name"] = req.body.name
    }
    // Component
    if (req.body.component == null) {
        attributes["component"] = part.component
    }
    else {
        attributes["component"] = req.body.component
    }
    // Instal_date
    if (req.body.install_date == null) {
        attributes["install_date"] = part.install_date
    }
    else {
        attributes["install_date"] = req.body.install_date
    }
    // Parts 
    attributes["car"] = part.car;

    return attributes;
}

/* ------------- End Helper Functions ----------------- */

module.exports = router;