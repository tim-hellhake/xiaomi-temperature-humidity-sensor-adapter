/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

declare module 'xiaomi-gap-parser' {
    function readServiceData(buffer: Buffer): Result;

    interface Result {
        event: Event
    }

    interface Event {
        data: Data
    }

    interface Data {
        tmp: number
        hum: number
    }
}
