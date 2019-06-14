/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

const noble = require('@abandonware/noble');
const {
  readServiceData
} = require('xiaomi-gap-parser');

const {
  Adapter,
  Device,
  Property
} = require('gateway-addon');

class TemperatureHumiditySensor extends Device {
  constructor(adapter, manifest, id) {
    super(adapter, `${manifest.display_name}-${id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor'];
    this.name = manifest.display_name;
    this.description = manifest.description;

    this.addProperty({
      type: 'number',
      '@type': 'TemperatureProperty',
      minimum: -127.99,
      maximum: 127.99,
      multipleOf: 0.1,
      unit: 'degree celsius',
      title: 'temperature',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.addProperty({
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 0.1,
      unit: '%',
      title: 'humidity',
      description: 'The relative humidity',
      readOnly: true
    });
  }

  addProperty(description) {
    const property = new Property(this, description.title, description);
    this.properties.set(description.title, property);
  }

  setData(serviceData) {
    const result = readServiceData(serviceData.data);

    if (result.event && result.event.data) {
      const data = result.event.data;

      if (data.tmp) {
        const temperature = result.event.data.tmp;
        const property = this.properties.get('temperature');
        property.setCachedValue(temperature);
        this.notifyPropertyChanged(property);
      }

      if (data.hum) {
        const humidity = result.event.data.hum;
        const property = this.properties.get('humidity');
        property.setCachedValue(humidity);
        this.notifyPropertyChanged(property);
      }
    }
  }
}

class TemperatureHumiditySensorAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, TemperatureHumiditySensorAdapter.name, manifest.name);
    this.pollInterval = manifest.moziot.config.pollInterval;
    this.knownDevices = {};
    addonManager.addAdapter(this);

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', (peripheral) => {
      const serviceDataList = peripheral.advertisement.serviceData;

      if (serviceDataList && serviceDataList[0]) {
        const serviceData = serviceDataList[0];

        if (serviceData.uuid == 'fe95') {
          const id = peripheral.id;
          let knownDevice = this.knownDevices[id];

          if (!knownDevice) {
            // eslint-disable-next-line max-len
            console.log(`Detected new Temperature Humidity Sensor with id ${id}`);
            knownDevice = new TemperatureHumiditySensor(this, manifest, id);
            this.handleDeviceAdded(knownDevice);
            this.knownDevices[id] = knownDevice;
          }

          knownDevice.setData(serviceData);
        }
      }
    });
  }
}

module.exports = TemperatureHumiditySensorAdapter;
