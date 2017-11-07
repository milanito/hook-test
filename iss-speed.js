var axios = require('axios')
var _ = require('lodash')
var moment = require('moment')
var MongoClient = require('mongodb').MongoClient

var DATA_COLLECTION = 'iss-data'
var EARTH_RADIUS = 6378e3
var API_URL = 'http://api.open-notify.org/iss-now.json'

/**
 * This function takes an angle in degree and returns it
 * in radian
 * @param { Double } degrees the angle in degrees
 * @return { Double } the radians
 */
var degToRad = function (degrees) {
  return degrees * Math.PI / 180
}

/**
 * This function will calculate the position
 * in a 3D system with vectorized parameters from the
 * longitude/latitude
 * @param { Double } lat the Latitude
 * @param { Double } lng the Longitude (so hard to guess)
 * @returns { Object } a vector as an object
 */
var calculatePosition = function(lat, lng) {
  var rho = EARTH_RADIUS * Math.cos(degToRad(lat))

  return {
    x: rho * Math.cos(degToRad(lng)),
    y: rho * Math.sin(degToRad(lng)),
    z: EARTH_RADIUS * Math.sin(degToRad(lat)),
  }
}

/**
 * This function calculate the distance between 2 points
 * on earth
 * @param { Object } pt1 the first point
 * @param { Object } pt2 the second point (those comments are neat)
 * @return { Double } The distance between the two
 */
var calculateDistance = function(pt1, pt2) {
  var cos_theta = (pt1.x * pt2.x + pt1.y * pt2.y + pt1.z * pt2.z) / (EARTH_RADIUS * EARTH_RADIUS)

  return EARTH_RADIUS * Math.acos(cos_theta)
}

/**
 * This function takes 2 entries in DB and calculate the speed between
 * the two points
 * @param { Object } source The object in DB
 * @param { Object } destination The object to be inserted
 * @returns { Double } The ISS's speed
 */
var calculateSpeed = function (source, destination) {
  var distance = calculateDistance(calculatePosition(parseFloat(source.position.latitude), parseFloat(source.position.longitude)),
    calculatePosition(parseFloat(destination.position.latitude), parseFloat(destination.position.longitude)))
  return distance / moment(destination.date).diff(moment(source.date), 'seconds')
}

/**
 * This function will fetch the position from the ISS webservice, if
 * the call is successfull :
 *
 * - If there is already a data inside the DB, it will calculate the speed
 *   of the ISS, taking the last good value
 * - If there is none, it will simply register the position
 *
 * In any case, it will save the position and date
 * @param { Object } ctx the webtask context
 * @param { Function } cb the webpack callback
 * @returns { Void }
 */
var handler = function(ctx, cb) {
  return MongoClient.connect(ctx.data.MONGO_URI)
  .then(function(client) {
    return axios.get(API_URL)
    .then(function (response) {
      var data = _.get(response, 'data', {})
      if (_.isEqual(_.get(data, 'message', 'error'), 'success')) {
        return {
          client: client,
          data: {
            date: moment.unix(parseFloat(_.get(data, 'timestamp', 0))).toDate(),
            position: _.get(data, 'iss_position', {})
          }
        }
      }
      throw new Error(data.message)
    })
  })
  .then(function(item) {
    var col = item.client.collection(DATA_COLLECTION)

    col
      .find().sort([['date', -1]]).limit(1)
      .nextObject(function(err, it) {
        if (err) {
          throw err
        }
        var speed = 0
        if (!_.isNull(it)) {
          speed = calculateSpeed(it, item.data)
        }
        return col.insertOne(_.merge(item.data, {
          speed: speed
        }))
        .then(function(ins) {
          item.client.close()
          return cb(null, ins)
        })
      })
  })
  .catch(function(err) {
    return cb(err)
  })
}

module.exports = handler
