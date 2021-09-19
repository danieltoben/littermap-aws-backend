// Connection information is provided using specially named environment variables
const postgres = require('postgres')

const sql_reset_db = `
  DROP SCHEMA IF EXISTS world CASCADE;
  DROP ROLE IF EXISTS reader;
  DROP ROLE IF EXISTS writer;
  DROP EXTENSION IF EXISTS postgis;
`

const sql_postgis_init = `
  CREATE EXTENSION postgis;
`

//
// Locations use EPSG:4326 latitude/longitude coordinate system (same as GPS)
//
const sql_create_world = `
  CREATE SCHEMA world;

  CREATE TABLE world.locations (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    lat FLOAT NOT NULL,
    lon FLOAT NOT NULL,
    geo GEOMETRY(POINT, 4326) NOT NULL,
    created_by TEXT
  );

  CREATE ROLE writer LOGIN ENCRYPTED PASSWORD '${process.env.DB_WRITER_PASSWORD}' NOCREATEROLE NOCREATEDB NOSUPERUSER NOINHERIT;

  CREATE ROLE reader LOGIN ENCRYPTED PASSWORD '${process.env.DB_READER_PASSWORD}' NOCREATEROLE NOCREATEDB NOSUPERUSER NOINHERIT;
`

const sql_grant_permissions = `
  GRANT USAGE ON SCHEMA world TO writer;
  GRANT USAGE ON ALL SEQUENCES IN SCHEMA world TO writer;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA world TO writer;

  GRANT USAGE ON SCHEMA world TO reader;
  GRANT SELECT ON ALL TABLES IN SCHEMA world TO reader;
`

exports.handler = async function(event, context) {
  let status = 200, log = []

  const pg = postgres()

  try {
    await pg.unsafe(sql_reset_db)
    log.push({
      completed: "Performed factory reset of the database"
    })

    await pg.unsafe(sql_postgis_init)
    log.push({
      completed: "Initialized PostGIS"
    })

    await pg.unsafe(sql_create_world)
    log.push({
      completed: "Created tables and users"
    })

    await pg.unsafe(sql_grant_permissions)
    log.push({
      completed: "Created user permissions"
    })
  } catch(e) {
    status = 500
    log.push({
      error: "Database correspondence error",
      reason: e.message
    })
  } finally {
    pg.end()
  }

  return {
    statusCode: status,
    body: JSON.stringify({ log })
  }
}