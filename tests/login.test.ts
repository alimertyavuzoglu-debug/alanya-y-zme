import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loginSchema,loginFailure} from '../src/lib/login';
test('login normalizes email only and preserves every password character',()=>{
 const parsed=loginSchema.parse({email:' DenizAslanlari@Gmail.com ',password:'  exact-fixture-password  '});assert.equal(parsed.email,'denizaslanlari@gmail.com');assert.equal(parsed.password,'  exact-fixture-password  ');
 assert.equal(loginSchema.safeParse({email:'not-an-address',password:'x'}).success,false);assert.equal(loginSchema.safeParse({email:'user@example.com',password:'x',role:'ADMIN'}).success,false);
});
test('login distinguishes verification and rate limits from bad credentials and outages',()=>{
 assert.equal(loginFailure({code:'email_not_confirmed',status:400}).status,403);assert.match(loginFailure({code:'email_not_confirmed'}).message,/doğrulanmamış/);
 assert.equal(loginFailure({code:'invalid_credentials',status:400}).status,401);assert.match(loginFailure({code:'invalid_credentials'}).message,/Kulüp hesabınız/);
 assert.equal(loginFailure({code:'user_banned'}).status,403);
 for(const error of [{status:429},{code:'over_request_rate_limit'},{code:'over_email_send_rate_limit'}])assert.equal(loginFailure(error).status,429);
 for(const error of [{status:500},{status:502},{name:'AuthRetryableFetchError'},{}]){const problem=loginFailure(error);assert.equal(problem.status,503);assert.doesNotMatch(problem.message,/parola hatalı/);}
});
