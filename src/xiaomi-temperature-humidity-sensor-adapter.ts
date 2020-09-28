/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

'use strict';

import { Adapter, Device, Property } from 'gateway-addon';

import noble, { Characteristic, Peripheral } from '@abandonware/noble';

import { readServiceData } from 'xiaomi-gap-parser';

class TemperatureHumiditySensor extends Device {
  protected temperatureProperty: Property;
  protected humidityProperty: Property;

  constructor(adapter: Adapter, manifest: any, id: string) {
    super(adapter, `${manifest.display_name}-${id}`);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor', 'HumiditySensor'];
    this.name = manifest.display_name;
    this.description = manifest.description;

    this.temperatureProperty = new Property(this, 'temperature', {
      type: 'number',
      '@type': 'TemperatureProperty',
      minimum: -127.99,
      maximum: 127.99,
      multipleOf: 0.1,
      unit: 'degree celsius',
      title: 'Temperature',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.properties.set('temperature', this.temperatureProperty);

    this.humidityProperty = new Property(this, 'humidity', {
      type: 'number',
      '@type': 'HumidityProperty',
      minimum: 0,
      maximum: 100,
      multipleOf: 0.1,
      unit: '%',
      title: 'Humidity',
      description: 'The relative humidity',
      readOnly: true
    });

    this.properties.set('humidity', this.humidityProperty);
  }

  setData(serviceData: { uuid: string, data: Buffer }) {
    const result = readServiceData(serviceData.data);

    if (result.event && result.event.data) {
      const data = result.event.data;

      if (data.tmp) {
        const temperature = result.event.data.tmp;
        this.temperatureProperty.setCachedValueAndNotify(temperature);
      }

      if (data.hum) {
        const humidity = result.event.data.hum;
        this.humidityProperty.setCachedValueAndNotify(humidity);
      }
    }
  }
}

const EXTRACTORS: { [key: string]: (characteristic: Characteristic) => Promise<{}> } = {
  '2a19': (characteristic: Characteristic) => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Reading battery characteristic`);
        characteristic.read((error, data) => {
          if(error) {
            reject(error);
            return;
          }

          const battery = data.readInt8(0);
          resolve({ battery });
        });
      } catch (e) {
        reject(`Could not read battery characteristic: ${e}`);
      }
    });
  },
  'ebe0ccc17a0a4b0c8a1a6ff2997da3a6': (characteristic: Characteristic) => {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Reading temperature/humidity characteristic`);
        characteristic.subscribe();
        characteristic.on('data', (data: Buffer) => {
          const temperature = data.readInt16LE(0) / 100;
          const humidity = data.readInt8(2);
          characteristic.unsubscribe();
          resolve({ temperature, humidity });
        });
      } catch (e) {
        reject(`Could not read temperature/humidity characteristic: ${e}`);
      }
    });
  }
}

class EncryptedTemperatureHumiditySensor extends TemperatureHumiditySensor {
  private batteryProperty: Property;

  constructor(adapter: Adapter, manifest: any, id: string, private peripheral: Peripheral) {
    super(adapter, manifest, id);
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this['@type'] = ['TemperatureSensor', 'HumiditySensor'];
    this.name = manifest.display_name;
    this.description = manifest.description;

    this.batteryProperty = new Property(this, 'battery', {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      multipleOf: 1,
      unit: 'percent',
      title: 'Battery',
      description: 'The ambient temperature',
      readOnly: true
    });

    this.properties.set('battery', this.batteryProperty);
  }

  async poll() {
    const data: any = await this.getData();

    if (data.temperature) {
      this.temperatureProperty.setCachedValueAndNotify(data.temperature);
    }

    if (data.humidity) {
      this.humidityProperty.setCachedValueAndNotify(data.humidity);
    }

    if (data.battery) {
      this.batteryProperty.setCachedValueAndNotify(data.battery);
    }
  }

  private async getData() {
    return new Promise((resolve, reject) => {
      this.peripheral.once('connect', () => {
        console.log(`Connected to ${this.peripheral.id}`);
        console.log(`Discovering services of ${this.peripheral.id}`);

        this.peripheral.discoverSomeServicesAndCharacteristics([], Object.keys(EXTRACTORS), async (error, _, characteristics) => {
          if (error) {
            console.log(error);
            reject(error);
          }

          console.log(`Discovered services of ${this.peripheral.id}`);

          const promises = characteristics
            .filter(characteristic => EXTRACTORS[characteristic.uuid])
            .map(characteristic => EXTRACTORS[characteristic.uuid](characteristic));

          const results = await Promise.all(promises);
          const result = results.reduce((acc, v) => Object.assign(acc, v));
          resolve(result);
        });
      });

      console.log(`Connecting to ${this.peripheral.id}`);
      this.peripheral.connect();
    });
  }
}

export class TemperatureHumiditySensorAdapter extends Adapter {
  private knownDevices: { [key: string]: TemperatureHumiditySensor } = {};
  private encryptedKnownDevices: { [key: string]: EncryptedTemperatureHumiditySensor } = {};

  constructor(addonManager: any, manifest: any) {
    super(addonManager, TemperatureHumiditySensorAdapter.name, manifest.name);
    addonManager.addAdapter(this);

    setInterval(async () => {
      for (const device of Object.values(this.encryptedKnownDevices)) {
        await device.poll();
      }
    }, 60000)

    noble.on('stateChange', (state) => {
      console.log('Noble adapter is %s', state);

      if (state === 'poweredOn') {
        console.log('Start scanning for devices');
        noble.startScanning([], true);
      }
    });

    noble.on('discover', async (peripheral) => {
      const serviceDataList = peripheral.advertisement.serviceData;

      if (serviceDataList && serviceDataList[0]) {
        const serviceData = serviceDataList[0];

        if (serviceData.uuid == 'fe95') {
          const id = peripheral.id;
          const data = readServiceData(serviceData.data);

          if (data.productId == 1371) {
            let knownEncryptedKnownDevice = this.encryptedKnownDevices[id];

            if (!knownEncryptedKnownDevice) {
              console.log(`Detected new encrypted Temperature Humidity Sensor with id ${id}: ${JSON.stringify(data)}`);
              knownEncryptedKnownDevice = new EncryptedTemperatureHumiditySensor(this, manifest, id, peripheral);
              this.handleDeviceAdded(knownEncryptedKnownDevice);
              this.encryptedKnownDevices[id] = knownEncryptedKnownDevice;
              await knownEncryptedKnownDevice.poll();
            }
          } else {
            if (data.frameControl.indexOf('EVENT_INCLUDE') > 0) {
              let knownDevice = this.knownDevices[id];

              if (!knownDevice) {
                console.log(`Detected new Temperature Humidity Sensor with id ${id}: ${JSON.stringify(data)}`);
                knownDevice = new TemperatureHumiditySensor(this, manifest, id);
                this.handleDeviceAdded(knownDevice);
                this.knownDevices[id] = knownDevice;
              }

              knownDevice.setData(serviceData);
            }
          }
        }
      }
    });
  }

  startPairing() {
    console.log('Start pairing');

    for (const id in this.knownDevices) {
      const device = this.knownDevices[id];
      this.handleDeviceAdded(device);
    }
  }

  cancelPairing() {
    console.log('Cancel pairing');
  }
}
