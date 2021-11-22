# AMPlify
## Apartment Management Project
#### To run this project, go to your git bash and do this
```
git clone https://github.com/IIInvokeII/AMPlify.git
cd AMPlify
npm install
npm run devStart
```

## You also need the following for this to work:
### Local MongoDB Instance (MongoDB Compass)
### Postman (DevTool for Admin Profile Creation)
#### In Postman: POST = http://localhost:3000/su/register_admin
#### You need to send a raw JSON file in the body:
```
{
  "name": "My Name",
  "username": "admin",
  "password": "admin",
  "apartment": "Some Place",
  "contact": "1234567890",
  "doorNumber": "123"
}
```
### Git Bash (You might already have this, but listing it here just in case)
