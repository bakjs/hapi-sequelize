const Joi = require('joi');
const Sequelize = require('sequelize');

const option = Joi.object().keys({
    name: Joi.string().token().required(),
    models: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(Joi.string())
    ),
    sync: Joi.boolean().default(false),
    forceSync: Joi.boolean().default(false),
    debug: Joi.boolean(),
    onConnect: Joi.func(),

    sequelize: Joi.object().type(Sequelize),

    connection: Joi.alternatives(Joi.string(), Joi.object().unknown().keys({
        dialect: Joi.string().optional(),
        database: Joi.string().optional(),
        username: Joi.string().optional(),
        password: Joi.string().optional(),
    }))
});

const options = Joi.alternatives().try(Joi.array().items(option), option);

module.exports = {
    option,
    options,
};
