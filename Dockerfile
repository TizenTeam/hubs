FROM node
WORKDIR /src
EXPOSE 8080
ENTRYPOINT ["npm", "start"]
COPY . /src
RUN npm install
