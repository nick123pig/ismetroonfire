IsMetroOnFire
=============

[www.IsMetroOnFire.com](http://www.ismetroonfire.com/)

This project is a [serverless](https://serverless.com) function that runs every 15 minutes and checks the [DC Metro Hero](https://dcmetrohero.com/) for smoke/fire reports. 

#### Thanks
Huge you goes out to [DC Metro Hero](https://dcmetrohero.com/) for giving us access to their amazing free API. Consider becoming a [patron of DC Metro Hero](https://www.patreon.com/metrohero)

#### Setup
```
npm install -g serverless
npm install
serverless invoke [local] -f scrape
```
