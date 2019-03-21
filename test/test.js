const assert = require("assert");
const chai = require("chai");
chai.should();
chai.use(require("chai-http"));
const config = require("config");
const app = require("../index");
const request = require("supertest");
const agent = request.agent;
console.log(process.env.NODE_ENV);
// describe("Array tests", () => {
//   it("should be ok", () => {
//     assert.equal([1, 2, 3].length, 3);
//   });
//   it("should be ok", () => {
//     assert.equal([1, 2, 3].join(","), "1,2,3");
//   });
// });

describe("Calc tests", () => {
  it("Main request", done => {
    request(app)
      .get("/")
      .expect(200, done);
  });
});

describe("Login package", () => {

  const user = agent(app);
  it('Right password', (done) => {
    user
    .post('/login')
    .send({'email': 'dentalon599@gmail.com', 'password': '101515'})
    .expect(302)
    .end(done);
  });
  it('Access permit', done => {
    user
    .get('/orders')
    .expect(200, done);
  });

  const unauthorizedUser = agent(app);
  it('Wrong password', done => {
    unauthorizedUser
    .post('/login')
    .send({'email': 'dentalon599@gmail.com', 'password': 'wrong_password'})
    .expect(401, done);
  });
  
  it('Access denied', done => {
    unauthorizedUser
    .get('/orders')
    .expect(401, done);
  });
});
