This is an example of an AWS lambda function with an automatic function update.
The database must be in AWS. The connection is indicated in the function parameters.
The function can be associated with the Gateway API and used to receive data in JSON and XML format.

console.log() write logs to the ClowdWatch directly.

**These are examples of JSON and XML body:**

```json
{
	"body": [{
		"title": "Test title",
		"name": "Vogue",
		"publisher": "Vogue publisher",
		"publication_code": "US123456",
		"publication_number": 10,
		"publication_date": "2018-11-30T16:57:53+00:00",
		"country": "US",
		"language": "en",
		"genres": ["women", "beauty"],
		"isTest": true
	}]
}
```

```xml
<?xml version="1.0" encoding="UTF-8"?>
    <Magazine>
        <Title>Test title</Title>
        <Name>Vogue</Name>
        <Publisher>Vogue publisher</Publisher>
        <PublicationCode>US123456</PublicationCode>
        <PublicationNumber>10</PublicationNumber>
        <PublicationDate>2018-11-30T16:57:53+00:00</PublicationDate>
        <Country>US</Country>
        <Language>en</Language>
        <Genre>women</Genre>
        <IsTest>true</IsTest>
    </Magazine>
```

