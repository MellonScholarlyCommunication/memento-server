# memento-server

An experimental Memento (RFC 7089) server.

## Install

```
yarn
```

## Configure

Edit the `.env` to set the absolute path of the Menento git repository : `MEMENTO_REPOSITORY`.

## Demo

Initialize the repository:

```
yarn init-repository
```

Start the server:

```
yarn server
```

Post a demonstraton [Event Notifications](https://www.eventnotifications.net) `Offer` containing an event log link:

```
yarn demo-post
```

Process the LDN inbox of this server:

```
yarn handle-inbox
```

Optionally send Event Notification in the outbox to the target:

```
yarn handle-outbox
```

Consult the Memento TimeMap for the demo event log:

```
curl http://localhost:8000/map/http://localhost:8000/demo/paper01/eventlog.jsonld
```

Retrieve a memento for the demo event log:

```
curl http://localhost:8000/memento/20240408104031/http://localhost:8000/demo/paper01/eventlog.jsonld
```