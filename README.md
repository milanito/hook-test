# ISS Test webtask

This CRON job will fetch the ISS position using the official API and save the position and speed in database.

To register the job, enter the following command :

```bash
$ wt cron create -n isscron -s MONGO_URI=<your mongo URI> --schedule <your schedule> iss-speed.js
```

Replace :

- `your mongo URI` with a URI with this format : `mongodb://<dbuser>:<dbpassword>@<host>:<port>/<database name>`
- `your schedule` with a [webtask schedule](https://webtask.io/docs/cron)

## NB

> There seems to be an [issue](https://github.com/auth0/wt-cli/issues/157) with the *wt-cli* when using the `update` on CRON jobs. The easiest way to get rid of it would be to use the `rm` command and `create` again the CRON webtask
