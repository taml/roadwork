"use strict";

const pluralize = require('pluralize');
const Code = require('code');
const Lab = require('lab');
const lab = exports.lab = Lab.script();
const sinon = require('sinon');

// Define shortcuts
const describe = lab.describe;
const it = lab.it;
const before = lab.before;
const beforeEach = lab.beforeEach;
const after = lab.after;
const expect = Code.expect;

const HapiAdapter = require(process.cwd() + '/src/adapters/hapi');
const RouteGenerator = require(process.cwd() + '/src/RouteGenerator');
const RoadworkAuthentication = require('roadwork-authentication');

const Boom = require('boom');

describe('routeGenerator /update', () => {
    let server, roadworkAuthentication, hapiAdapter, routeGenerator, routeGeneratorWithoutAuthentication;

    const mockModel = {
        baseRoute: 'mocks',
        updateById: function (payload) {
            return 'update_called';
        },
        updateByIdAndUserId: function (id, userId) {
            return `updateByIdAndUserId_called_with_id_${id}_and_userId_${userId}`;
        }
    };

    const defaultRoute = `/${mockModel.baseRoute}/{id}`;

    before((done) => {
        server = require('../helpers/server-hapi').init();
        roadworkAuthentication = new RoadworkAuthentication(server, {});
        hapiAdapter = new HapiAdapter(server);
        routeGenerator = new RouteGenerator(hapiAdapter, roadworkAuthentication, { basePath: '' });
        routeGeneratorWithoutAuthentication = new RouteGenerator(hapiAdapter, null, { basePath: '' });

        done();
    });

    describe('basics', () => {
        it('should correctly register the route in the hapi framework', (done) => {
            server.route(routeGenerator.generateUpdate(mockModel, null));

            const routes = server.table()[0].table;

            expect(routes).to.include({ method: 'put' });
            expect(routes).to.include({ path: defaultRoute });

            done();
        });

        it('should return the correct routeoptions', (done) => {
            var options = routeGenerator.generateUpdate(mockModel, null); // model, rolesAllowed

            expect(options.method).to.equal('PUT');
            expect(options.path).to.equal(defaultRoute);
            expect(options.handler).to.exist();

            done();
        });

        it('should have authentication in the routeoptions if authentication is enabled', (done) => {
            var options = routeGenerator.generateUpdate(mockModel, { allowedRoles: [ 'user' ] }); // model, rolesAllowed

            expect(options.config).to.exist();
            expect(options.config.auth).to.exist();
            expect(options.config.auth.strategy).to.equal(roadworkAuthentication.strategyName);

            done();
        });

        it('should not have authentication in the routeoptions if authentication is not enabled', (done) => {
            var options = routeGeneratorWithoutAuthentication.generateUpdate(mockModel, { allowedRoles: [ 'user' ] }); // model, rolesAllowed

            expect(options.config).to.not.exist();

            done();
        });

        it('should change the basePath if we configured it', (done) => {
            const basePath = '/newPath';
            const routeGeneratorNew = new RouteGenerator(hapiAdapter, null, { basePath: basePath });
            const result = routeGeneratorNew.generateUpdate(mockModel, null);

            expect(result.path).to.equal(`${basePath}${defaultRoute}`);

            done();
        });
    });

    describe('handler', () => {
        let request = {
            params: {
                id: 666
            },
            auth: {
                credentials: {
                    get: function (key) {
                        switch (key) {
                            case 'id':
                                return 25;
                                break;
                            case 'scope':
                                return [ 'user', '$owner' ];
                            default:
                                return `not_defined_key:_${key}`;
                        }
                    }
                }
            }
        };

        it('should return unauthorized when there are no roles passed', (done) => {
            let options = routeGenerator.generateUpdate(mockModel, { allowedRoles: [ ] }); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal(Boom.unauthorized());
                done();
            });
        });

        it('should return unauthorized when we have NO_ACCESS', (done) => {
            let options = routeGenerator.generateUpdate(mockModel, { allowedRoles: [ 'admin' ] }); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal(Boom.unauthorized());
                done();
            });
        });

        it('should call model.updateByIdAndUserId when we have OWNER_ACCESS', (done) => {
            let options = routeGenerator.generateUpdate(mockModel, { allowedRoles: [ '$owner' ] }); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal(`updateByIdAndUserId_called_with_id_${request.params.id}_and_userId_${request.auth.credentials.get('id')}`);
                done();
            });
        });

        it('should call model.update when we have ALL_ACCESS', (done) => {
            let options = routeGenerator.generateUpdate(mockModel, { allowedRoles: [ 'user' ] }); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal('update_called');
                done();
            });
        });

        it('should call model.update when we have authentication registered and rolesAllowed is null', (done) => {
            let options = routeGenerator.generateUpdate(mockModel, null); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal('update_called');
                done();
            });
        });

        it('should call model.update when we have no authentication registered and rolesAllowed is null', (done) => {
            let options = routeGeneratorWithoutAuthentication.generateUpdate(mockModel, null); // model, rolesAllowed

            options.handler(request, (result) => {
                expect(result).to.equal('update_called');
                done();
            });
        });
    });
});