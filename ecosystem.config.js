module.exports = {
	apps: [
		{
			name: 'coral-control',
			script: 'src/server.js',
			autorestart: true,
			watch: false,
			time: true,
			error_file: 'logs/pm2-error.log',
			out_file: 'logs/pm2-out.log',
			log_file: null,
		},
	],
};
