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
                body: '[BadRequest] Validation errors:\n{errors}'.formatUnicorn({errors: v.validate(event, structure).toString()})
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
            if (result.magazinesData.length !== 0) {
                let query = "INSERT INTO `Magazines`" +
                    "(`title`, `name`, `publisher`, `publication_number`, `publication_date``, `country`, `language`, `genres`, `is_test`) " +
                    "VALUES " +
                    result.magazinesData.join(', ');
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
                    resolve({statusCode: 200, body: result.magazinesData});
                });
            } else {
                resolve({statusCode: 200, body: result.magazinesData});
            }
        });
    });
};

function getXmlMagazines(xmlStr)
{
    let xmlDoc = libxmljs.parseXml(xmlStr);
    let xmlSchema = libxmljs.parseXml(xmlStructure);
    let result = xmlDoc.validate(xmlSchema);
    if (!result) {
        return false;
    }
    let record = xmlDoc.get('//Magazine');
    let magazines = [];
    let magazine = {
        'title'              : record.get('title').text(),
        'name'               : [record.get('name').text()],
        'publisher'          : [record.get('publisher').text()],
        'publication_number' : record.get('publication_number').text(),
        'publication_date'   : [record.get('publication_date').text()],
        'country'            : [record.get('country').text()],
        'language'           : [record.get('language').text()],
        'genres'             : [record.get('genres').text()],
        'isTest'             : 'true' === record.get('isTest').text(),
    };
    magazines.push(magazine);

    return magazines;
}

function prepareDbMagazinesData (connection, baseUrl, trips, apiKey) {

}
