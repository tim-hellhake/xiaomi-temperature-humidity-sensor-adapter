# Xiaomi Bluetooth Temperature and Humidity Sensor Adapter

[![Build Status](https://travis-ci.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter.svg?branch=master)](https://travis-ci.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter)
[![dependencies](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter.svg)](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter)
[![devDependencies](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter/dev-status.svg)](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter?type=dev)
[![optionalDependencies](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter/optional-status.svg)](https://david-dm.org/tim-hellhake/xiaomi-temperature-humidity-sensor-adapter?type=optional)
[![license](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)

Connect your Xiaomi Bluetooth Temperature and Humidity Sensor.

## Known issues

### Temperature and humidity are `0`
The temperature and humidity values are sent periodically by the sensor.

It may take some time until the first update arrives after adding the sensor or restarting the gateway.

## Configuration:
- Go to 'Add Thing'
- A new sensor should appear
