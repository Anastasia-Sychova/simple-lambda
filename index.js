let mysql = require('mysql2');

let libxmljs = require("libxmljs")
let fs = require("fs");
require('format-unicorn');
let Validator = require('jsonschema').Validator;
let v = new Validator();

let structure = require('./schema/magazine.json');
let xmlStructure = fs.readFileSync("./schema/magazine.xml");

exports.handler = (event) => {
    return new Promise((resolve, reject) => {
        if (undefined !== event.xmlBody) {
            let magazines = getXmlMagazines(event.xmlBody);
            if (!magazines) {
                reject(JSON.stringify({
                    statusCode: 400,
                    body: '[BadRequest] Validation errors:\n XML document is invalid or does not conform to the scheme'
                }));
            }
            delete event.xmlBody;
            event.body = magazines;
            console.info('Incoming data after getXmlMagazines:', event);
        }
        if (!v.validate(event, structure).valid) {
            reject(JSON.stringify({
                statusCode: 400,
                body: '[BadRequest] Validation errors:\n{errors}'.formatUnicorn(
                    {errors: v.validate(event, structure).toString()})
            }));
        }

        let connection = mysql.createConnection({
            host: process.env.host,
            port: 3306,
            user: process.env.user,
            password: process.env.password,
            database: process.env.database,
            ssl: 'Amazon RDS',
            authSwitchHandler: function (data, cb) { // modifies the authentication handler
                if (data.pluginName === 'mysql_clear_password') { // authentication token is sent in clear text but connection uses SSL encryption
                    cb(null, Buffer.from(process.env.password + '\0'));
                }
            }
        });

        connection.connect();

        prepareDbMagazinesData(connection, event.body).then((result) => {
            if (result.length !== 0) {
                let query = "INSERT INTO `Magazines`" +
                    "(`title`, `name`, `publisher`, `publication_code`, `publication_number`," +
                    "`publication_date``, `country`, `language`, `genres`, `is_test`) " +
                    "VALUES " +
                    result.join(', ');
                console.log(query);
                connection.query(query, function (err, results, fields) {
                    if (err) {
                        console.error('Query error:', err);
                        reject(JSON.stringify({
                            statusCode: 500,
                            body: 'Internal error'
                        }));

                        return;
                    }

                    console.info('Successfully added', results);
                    resolve({statusCode: 200, body: result});
                });
            } else {
                resolve({statusCode: 200, body: result});
            }
        });
    });
};

function getXmlMagazines(xmlStr) {
    let result = '';
    let magazines = [];
    try {
        let xmlDoc = libxmljs.parseXml(xmlStr);
        let xmlSchema = libxmljs.parseXml(xmlStructure);
        result = xmlDoc.validate(xmlSchema);
        if (!result) {
            return false;
        }
        let record = xmlDoc.get('//Magazine');
        let magazine = {
            'title'              : record.get('Title').text(),
            'name'               : record.get('Name').text(),
            'publisher'          : record.get('Publisher').text(),
            'publication_code'   : record.get('PublicationCode').text(),
            'publication_number' : parseInt(record.get('PublicationNumber').text()),
            'publication_date'   : record.get('PublicationDate').text(),
            'country'            : record.get('Country').text(),
            'language'           : record.get('Language').text(),
            'genres'             : [record.get('Genre').text()],
            'isTest'             : 'true' === record.get('IsTest').text(),
        };
        magazines.push(magazine);
    } catch (e) {
        console.log(e);

        return false;
    }

    return magazines;
}

function prepareDbMagazinesData(connection, magazines) {
    let magazinesData = [];
    let checkedCount = 0;
    return new Promise (async function(resolve, reject) {
        magazines.forEach(function (magazineElement) {
            isMagazineExists(connection, magazineElement.publication_code).then((isAdded) => {
                console.log('Is magazine exists:', isAdded, magazineElement.publication_code);
                if (!isAdded) {
                    magazinesData.push(("({title}, {name}, {publisher}, {publicationCode}, {publicationNumber}, " +
                        "{publicationDate}', {country}, {language}, {genres}, {isTest}" +
                        "").formatUnicorn({
                        title            : mysql.escape(magazineElement.title),
                        name             : mysql.escape(magazineElement.name),
                        publisher        : mysql.escape(magazineElement.publisher),
                        publicationCode  : mysql.escape(magazineElement.publicationCode),
                        publicationNumber: mysql.escape(magazineElement.publicationNumber),
                        publicationDate  : mysql.escape(magazineElement.publicationDate),
                        country          : mysql.escape(magazineElement.country),
                        language         : mysql.escape(magazineElement.language),
                        genres           : JSON.stringify(magazineElement.genres),
                        isTest           : (undefined === magazineElement.isTest) ?
                            0 : mysql.escape(magazineElement.isTest),
                    }));
                }
                checkedCount++;
            });
        });
        let magazinesInterval = setInterval(function () {
            if (checkedCount === magazines.length) {
                clearInterval(magazinesInterval);

                    resolve(magazinesData);
                }
            });
    }).then(function(magazinesData){
        return magazinesData;
    });
};

function isMagazineExists (connection, publicationCode) {
    return new Promise (function(resolve, reject) {
        let query = "SELECT COUNT(*) AS magazinesCount FROM `magazines` WHERE publication_code={code}".formatUnicorn({
            code: mysql.escape(publicationCode),
        });
        connection.query(query, function (err, results, fields) {
            if (err) {
                console.error('Query error:', err);
                resolve(false);
            }

            resolve(results[0].magazinesCount > 0);
        });
    }).then(function(result){
        return result;
    });
};
