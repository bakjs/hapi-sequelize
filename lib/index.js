const Joi = require('joi');
const { assert } = require('hoek');
const Schema = require('./schema');
const Models = require('./models');
const DB = require('./DB');
const Pkg = require('../package.json');
const Sequelize = require('sequelize');

module.exports = {
    pkg: Pkg,
    once: true,
    name: 'sequelize',
    register,
};

async function register(server, options) {
    assert(options, 'Missing sequelize plugin options');

    // Normalize options into array form
    if (!Array.isArray(options)) {
        options = [options];
    }

    // Create sequelize instances if not provided
    for (const option of options) {
        if (!option.sequelize) {
            option.sequelize = new Sequelize(option.connection)
        }
    }

    await Joi.validate(options, Schema.options);

    server.decorate('request', 'getDb', getDb, {
        apply: true
    });

    server.events.on('stop', async function onStop() {
        const dbNames = options.map(option => option.name);
        const pluginContent = server.plugins.sequelize;

        await Promise.all(dbNames.map(dbName => pluginContent[dbName].sequelize.close()));
    });

    const configured = options.reduce(
        (acc, options) => [
            ...acc,
            configure(options).then(db => {
                server.expose(options.name, db);
                return db;
            })
        ], []
    );

    return Promise.all(configured);
}

async function configure(options) {
    try {
        await options.sequelize.authenticate();
    } catch (error) {
        throw new Error(
            `An error occurred while attempting to connect to DB[${options.name}],
            please check the configuration. Details: ${error.message}`
        );
    }

    let db = null;
    if (options.models) {
        const files = await Models.getFiles(options.models, options.ignore);
        let models = await Models.load(files, options.sequelize.import.bind(options.sequelize));
        models = await Models.applyRelations(models);

        if (options.sync) {
            await options.sequelize.sync({ force: options.forceSync });
        }

        db = new DB(options.sequelize, models);
    } else {
        db = new DB(options.sequelize, []);
    }

    if (options.onConnect) {
        let onConnect = options.onConnect(db);

        if (onConnect && typeof onConnect.then === 'function') {
            await onConnect;
        }
    }

    return db;
}

function getDb(request) {
    return function getDb(name) {
        if (!name) {
            const key = Object.keys(request.server.plugins.sequelize).shift();
            return request.server.plugins.sequelize[key];
        } else if (!request.server.plugins.sequelize.hasOwnProperty(name)) {
            throw new Error(`sequelize cannot find the ${name} database instance`);
        }

        return request.server.plugins.sequelize[name];
    }
}
